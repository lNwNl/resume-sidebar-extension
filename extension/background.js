'use strict';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

const targetKey = (tabId) => `target-${tabId}`;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.cmd === 'target-focus' && sender.tab?.id != null) {
    chrome.storage.session.set({
      [targetKey(sender.tab.id)]: { frameId: sender.frameId, at: Date.now() }
    });
    return;
  }
  if (message?.cmd === 'target-clear' && sender.tab?.id != null) {
    const key = targetKey(sender.tab.id);
    chrome.storage.session.get(key).then((stored) => {
      if (stored[key]?.frameId === sender.frameId) chrome.storage.session.remove(key);
    });
    return;
  }
  if (message?.cmd !== 'fill-active') return;
  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) return { ok: false, error: '没有活动网页，请先打开招聘表单' };
    const key = targetKey(tab.id);
    const stored = await chrome.storage.session.get(key);
    const target = stored[key];
    if (!target)
      return { ok: false, error: '请先点击网页中的可编辑字段' };
    try {
      return await chrome.tabs.sendMessage(tab.id, {
        cmd: 'fill', field: message.field, dateSeparator: message.dateSeparator
      }, { frameId: target.frameId });
    } catch {
      await chrome.storage.session.remove(key);
      return { ok: false, error: '目标页面暂不支持自动填写，请手动粘贴' };
    }
  })().then(sendResponse, () => sendResponse({ ok: false, error: '填写失败，请手动粘贴' }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(targetKey(tabId)));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') chrome.storage.session.remove(targetKey(tabId));
});
