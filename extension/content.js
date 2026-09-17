'use strict';

let target = null;
let editorRange = null;
let dateSeparator = '-';
let lastError = '';
const supportedInputTypes = new Set([
  'text', 'search', 'email', 'tel', 'url', 'number', 'date', 'month', 'radio', 'checkbox'
]);

function editableFrom(node) {
  if (!(node instanceof Element)) return null;
  const input = node.closest('input, textarea, select, [contenteditable], [role="combobox"], '
    + '[role="listbox"], [role="radio"], [role="checkbox"]');
  if (!input || input.disabled || input.readOnly) return null;
  if (input instanceof HTMLInputElement) return supportedInputTypes.has(input.type) ? input : null;
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) return input;
  if (['combobox', 'listbox', 'radio', 'checkbox'].includes(input.getAttribute('role'))) {
    return input.getAttribute('aria-disabled') === 'true' ? null : input;
  }
  return input.isContentEditable ? input : null;
}

function signal(cmd) {
  chrome.runtime.sendMessage({ cmd }).catch(() => {});
}

document.addEventListener('focusin', (event) => {
  const candidate = editableFrom(event.target);
  if (candidate) {
    target = candidate;
    editorRange = null;
    signal('target-focus');
  } else {
    target = null;
    editorRange = null;
    signal('target-clear');
  }
}, true);

document.addEventListener('pointerdown', (event) => {
  if (!editableFrom(event.target)) {
    target = null;
    editorRange = null;
    signal('target-clear');
  }
}, true);

document.addEventListener('selectionchange', () => {
  if (!target?.isContentEditable) return;
  const selection = document.getSelection();
  if (selection?.rangeCount && target.contains(selection.anchorNode)) {
    editorRange = selection.getRangeAt(0).cloneRange();
  }
});

function showError(message) { lastError = message; }

function dateFormat(iso, control) {
  const placeholder = control?.getAttribute('placeholder') || '';
  const hint = [placeholder, control?.getAttribute('aria-label') || '', control?.name || '',
    ...(control?.labels ? [...control.labels].map((label) => label.textContent) : [])].join(' ');
  const maxLength = control instanceof HTMLInputElement ? control.maxLength : -1;
  const yearOnly = maxLength === 4 || /^\s*yyyy\s*$/i.test(placeholder);
  const monthOnly = control instanceof HTMLInputElement && control.type === 'month'
    || (maxLength > 0 && maxLength <= 7)
    || (/年月|year.?month|yyyy[.\/-]mm/i.test(hint) && !/日|day|dd/i.test(hint));
  const [year, month, day] = iso.split('-');
  if (yearOnly) return year;
  if (control instanceof HTMLInputElement && control.type === 'date') return iso;
  if (control instanceof HTMLInputElement && control.type === 'month') return `${year}-${month}`;
  if (/年/.test(placeholder)) return `${year}年${month}月${monthOnly ? '' : `${day}日`}`;
  return [year, month, ...(!monthOnly ? [day] : [])].join(dateSeparator);
}

function resolvedValue(field, control) {
  if (field.kind === 'text') return field.value;
  if (field.kind === 'period') {
    if (control instanceof HTMLInputElement && ['date', 'month', 'number'].includes(control.type)
      || control instanceof HTMLSelectElement
      || control instanceof HTMLInputElement && ['radio', 'checkbox'].includes(control.type)
      || ['combobox', 'listbox', 'radio', 'checkbox'].includes(control.getAttribute('role'))) {
      showError('起止时间适用于文本框；日期控件请分别选择开始或结束时间');
      return null;
    }
    return `${dateFormat(field.start.value, control)} - ${field.end ? dateFormat(field.end.value, control) : '至今'}`;
  }
  if (field.value === '至今') return field.value;
  if (control instanceof HTMLInputElement && control.type === 'number') {
    showError('完整日期无法填入数字控件，请选择合适字段');
    return null;
  }
  return dateFormat(field.value, control);
}

const normalizedChoice = (value) => String(value || '').normalize('NFKC').replace(/\s+/g, '').trim();

function dateChoices(field, choices, control) {
  const [year, month, day] = field.value.split('-');
  const hint = normalizedChoice([control.getAttribute('aria-label'), control.name,
    ...(control.labels ? [...control.labels].map((label) => label.textContent) : [])].join(' '));
  const nums = choices.map((choice) => {
    const match = /^(\d{1,4})(?:年|月|日)?$/.exec(normalizedChoice(choice));
    return match ? Number(match[1]) : null;
  }).filter((number) => number !== null);
  const numericPart = nums.length >= 2 && nums.length === choices.length
    ? nums.every((number) => number >= 1900 && number <= 2100) ? 'year'
      : nums.every((number) => number >= 1 && number <= 12) ? 'month'
        : nums.every((number) => number >= 1 && number <= 31) && nums.some((number) => number > 12)
          ? 'day' : null
    : null;
  const part = numericPart || (/年份|^年$|year/i.test(hint) ? 'year'
    : /月份|^月$|month/i.test(hint) ? 'month'
      : /^日$|日份|\bday\b/i.test(hint) ? 'day' : null);
  if (part === 'year') return [year, `${year}年`];
  if (part === 'month') return [month, String(Number(month)), `${month}月`, `${Number(month)}月`];
  if (part === 'day') return [day, String(Number(day)), `${day}日`, `${Number(day)}日`];
  return [field.value, field.value.replaceAll('-', '.'), field.value.replaceAll('-', '/'),
    field.value.slice(0, 7), field.value.slice(0, 7).replace('-', '.')];
}

function selectMatch(select, field, value) {
  const options = [...select.options].filter((option) => !option.disabled);
  const labels = options.filter((option) => option.value
    || !/^\s*(?:请选择|选择|select)/i.test(option.textContent)).map((option) => option.textContent);
  const candidates = field.kind === 'date' ? dateChoices(field, labels, select) : [value];
  const wanted = new Set(candidates.map(normalizedChoice));
  const matches = options.filter((option) => wanted.has(normalizedChoice(option.value))
    || wanted.has(normalizedChoice(option.textContent)));
  return matches.length === 1 ? matches[0] : null;
}

function inputLabel(input) {
  return [input.getAttribute('aria-label') || '',
    ...(input.labels ? [...input.labels].map((label) => label.textContent) : []),
    input.closest('label')?.textContent || ''].map(normalizedChoice).filter(Boolean);
}

function checkedMatch(input, field, value) {
  const scope = input.form || document;
  const peers = [...scope.querySelectorAll(`input[type="${input.type}"]`)].filter((peer) =>
    peer.name === input.name && !peer.disabled && (input.name || peer === input));
  const candidates = field.kind === 'date'
    ? dateChoices(field, peers.map((peer) => inputLabel(peer)[0] || peer.value), input) : [value];
  const wanted = new Set(candidates.map(normalizedChoice));
  const matches = peers.filter((peer) =>
    (peer.value !== 'on' && wanted.has(normalizedChoice(peer.value)))
    || inputLabel(peer).some((label) => wanted.has(label)));
  return matches.length === 1 ? matches[0] : null;
}

async function customOption(control, field, value) {
  const controlled = control.getAttribute('aria-controls');
  const searchRoot = controlled && document.getElementById(controlled) || document;
  const find = () => {
    const options = [...searchRoot.querySelectorAll('[role="option"]')].filter((option) =>
      !option.hidden && option.getAttribute('aria-disabled') !== 'true'
      && option.getAttribute('aria-hidden') !== 'true' && getComputedStyle(option).display !== 'none');
    const candidates = field.kind === 'date'
      ? dateChoices(field, options.map((option) => option.textContent), control) : [value];
    const wanted = new Set(candidates.map(normalizedChoice));
    const matches = options.filter((option) => wanted.has(normalizedChoice(option.textContent))
      || wanted.has(normalizedChoice(option.getAttribute('aria-label'))));
    return matches.length === 1 ? matches[0] : null;
  };
  let option = find();
  if (!option) { control.click(); option = find(); }
  if (!option) {
    option = await new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const match = find();
        if (match) { observer.disconnect(); clearTimeout(timer); resolve(match); }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      const timer = setTimeout(() => { observer.disconnect(); resolve(find()); }, 500);
    });
  }
  if (!option) return false;
  const chosen = normalizedChoice(option.textContent);
  const before = normalizedChoice(control.textContent);
  const beforeValue = normalizedChoice(control.getAttribute('aria-valuetext'));
  option.click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const after = normalizedChoice(control.textContent);
  const afterValue = normalizedChoice(control.getAttribute('aria-valuetext'));
  return (after !== before && after.includes(chosen))
    || (afterValue !== beforeValue && afterValue.includes(chosen))
    || option.getAttribute('aria-selected') === 'true';
}

async function writeValue(field) {
  lastError = '';
  const control = target;
  if (!control || !control.isConnected || !editableFrom(control)) {
    target = null;
    showError('请先点击网页中的可编辑字段');
    return false;
  }
  const value = resolvedValue(field, control);
  if (value === null) return false;
  if (control instanceof HTMLInputElement && ['radio', 'checkbox'].includes(control.type)) {
    const match = checkedMatch(control, field, value);
    if (!match) { showError('没有唯一匹配的选项'); return false; }
    if (!match.checked) match.click();
    if (!match.checked) { showError('选项未被网站接受'); return false; }
    return true;
  }
  if (control instanceof HTMLSelectElement) {
    const match = selectMatch(control, field, value);
    if (!match) { showError('下拉框没有唯一匹配选项'); return false; }
    if (control.multiple) match.selected = true;
    else control.value = match.value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return control.multiple ? match.selected : control.value === match.value;
  }
  const role = control.getAttribute('role');
  if (role === 'radio' || role === 'checkbox') {
    const scope = control.closest('[role="radiogroup"], [role="group"]') || control.parentElement;
    const peers = [...scope.querySelectorAll(`[role="${role}"]`)].filter((peer) =>
      peer.getAttribute('aria-disabled') !== 'true');
    const wanted = normalizedChoice(value);
    const matches = peers.filter((peer) => normalizedChoice(peer.getAttribute('aria-label')) === wanted
      || normalizedChoice(peer.textContent) === wanted);
    if (matches.length !== 1) { showError('没有唯一匹配的选项'); return false; }
    if (matches[0].getAttribute('aria-checked') !== 'true') matches[0].click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (matches[0].getAttribute('aria-checked') !== 'true') {
      showError('网站没有确认选中状态，请检查或手动选择'); return false;
    }
    return true;
  }
  if (role === 'combobox' || role === 'listbox') {
    if (await customOption(control, field, value)) return true;
    showError('没有找到唯一匹配的自定义选项'); return false;
  }
  if (control instanceof HTMLInputElement && control.type === 'number'
    && !/^[-+]?\d+(\.\d+)?$/.test(value)) {
    showError('数字输入框只能填写数字'); return false;
  }
  if (control instanceof HTMLInputElement && control.type === 'date'
    && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    showError('日期框需要 YYYY-MM-DD 格式'); return false;
  }
  if (control instanceof HTMLInputElement && control.type === 'month'
    && !/^\d{4}-\d{2}$/.test(value)) {
    showError('月份框需要 YYYY-MM 格式'); return false;
  }
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    const prototype = control instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, value);
    control.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    if (control.value !== value || !control.checkValidity()) {
      showError('网站未接受该值，请检查或手动粘贴'); return false;
    }
    return true;
  }
  control.focus();
  const selection = document.getSelection();
  if (editorRange && control.contains(editorRange.commonAncestorContainer)) {
    selection.removeAllRanges(); selection.addRange(editorRange);
  } else {
    const range = document.createRange();
    range.selectNodeContents(control);
    selection.removeAllRanges(); selection.addRange(range);
  }
  if (!document.execCommand?.('insertText', false, value)) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(value);
    range.insertNode(node);
    range.setStartAfter(node); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range);
    control.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  }
  editorRange = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  if (!control.textContent.includes(value)) {
    showError('正文编辑区未显示该值，请检查或手动粘贴'); return false;
  }
  return true;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.cmd !== 'fill') return;
  if (['-', '.', '/'].includes(message.dateSeparator)) dateSeparator = message.dateSeparator;
  let copyValue = null;
  if (target?.isConnected) {
    lastError = '';
    copyValue = resolvedValue(message.field, target);
  }
  writeValue(message.field).then((ok) => sendResponse({ ok, error: lastError, copyValue }));
  return true;
});
