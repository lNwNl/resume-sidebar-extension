'use strict';

const layouts = globalThis.RESUME_LAYOUTS;
const content = document.getElementById('content');
const search = document.getElementById('search');
const fontSelect = document.getElementById('font-size');
const themeSelect = document.getElementById('theme');
const dateSelect = document.getElementById('date-separator');
const toast = document.getElementById('toast');
const media = matchMedia('(prefers-color-scheme: dark)');
let settings = { fontSize: '14', theme: 'auto', dateSeparator: '-' };
let toastTimer;

function applySettings() {
  document.documentElement.style.fontSize = `${settings.fontSize}px`;
  const theme = settings.theme === 'auto' ? (media.matches ? 'dark' : 'light') : settings.theme;
  document.documentElement.dataset.theme = theme;
  fontSelect.value = settings.fontSize;
  themeSelect.value = settings.theme;
  dateSelect.value = settings.dateSeparator;
}

function persist() { chrome.storage.local.set({ resumeSidebarSettings: settings }); }

function preview(field) {
  if (field.kind === 'date') return field.value.replaceAll('-', settings.dateSeparator);
  if (field.kind === 'period') {
    const start = field.start.value.replaceAll('-', settings.dateSeparator);
    const end = field.end?.value.replaceAll('-', settings.dateSeparator) || '至今';
    return `${start} - ${end}`;
  }
  return field.value;
}

function notice(message, duration = 3500) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, duration);
}

async function copy(value, automatic, error) {
  try {
    await navigator.clipboard.writeText(value);
    notice(error ? `${error}；已复制到剪贴板`
      : automatic ? '未能自动填写，已复制；请在网页中手动粘贴' : '已复制，请在网页中手动粘贴',
    error ? 10000 : 3500);
  } catch {
    notice(error || '复制失败，请手动选择字段内容', error ? 10000 : 3500);
  }
}

async function useField(field, event) {
  if (event.altKey) { await copy(preview(field), false); return; }
  let result;
  try {
    result = await chrome.runtime.sendMessage({
      cmd: 'fill-active', field, dateSeparator: settings.dateSeparator
    });
  } catch {
    result = { ok: false };
  }
  if (result?.ok) { notice('已填写'); return; }
  await copy(result?.copyValue || preview(field), true, result?.error);
}

function fieldButton(field) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'field';
  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = field.label;
  const value = document.createElement('span');
  value.className = 'field-value';
  value.textContent = preview(field);
  button.append(label, value);
  button.addEventListener('click', (event) => useField(field, event));
  return button;
}

function fieldsBlock(fields) {
  const box = document.createElement('div');
  box.className = 'fields';
  fields.forEach((field) => box.append(fieldButton(field)));
  return box;
}

function itemDetails(item) {
  const details = document.createElement('details');
  details.className = 'item';
  const summary = document.createElement('summary');
  summary.textContent = item.name;
  details.append(summary, fieldsBlock(item.fields));
  return details;
}

function groupDetails(group) {
  const details = document.createElement('details');
  details.className = 'group';
  const summary = document.createElement('summary');
  summary.textContent = group.name;
  const body = document.createElement('div');
  body.className = 'group-body';
  if (group.fields) body.append(fieldsBlock(group.fields));
  else group.items.forEach((item) => body.append(itemDetails(item)));
  details.append(summary, body);
  details.addEventListener('toggle', () => {
    if (!details.open || !group.items) return;
    const items = details.querySelectorAll(':scope > .group-body > .item');
    items.forEach((item) => { item.open = false; });
    if (items[0]) items[0].open = true;
  });
  return details;
}

function allFields() {
  return layouts.flatMap((group) => group.fields
    ? group.fields.map((field) => ({ group: group.name, field }))
    : group.items.flatMap((item) => item.fields.map((field) => ({ group: group.name, item: item.name, field }))));
}

function render() {
  content.replaceChildren();
  const query = search.value.trim().toLocaleLowerCase();
  if (!query) { layouts.forEach((group) => content.append(groupDetails(group))); return; }
  const matches = allFields().filter(({ group, item, field }) =>
    [group, item, field.label, preview(field)].some((part) => String(part || '').toLocaleLowerCase().includes(query)));
  if (!matches.length) {
    const empty = document.createElement('div');
    empty.className = 'empty'; empty.textContent = '没有匹配内容'; content.append(empty); return;
  }
  content.append(fieldsBlock(matches.map(({ group, item, field }) => ({
    ...field, label: [group, item, field.label].filter(Boolean).join(' · ')
  }))));
}

search.addEventListener('input', render);
fontSelect.addEventListener('change', () => { settings.fontSize = fontSelect.value; applySettings(); persist(); });
themeSelect.addEventListener('change', () => { settings.theme = themeSelect.value; applySettings(); persist(); });
dateSelect.addEventListener('change', () => { settings.dateSeparator = dateSelect.value; applySettings(); persist(); render(); });
media.addEventListener('change', () => { if (settings.theme === 'auto') applySettings(); });

chrome.storage.local.get('resumeSidebarSettings').then((stored) => {
  settings = { ...settings, ...stored.resumeSidebarSettings };
  applySettings();
  render();
});
