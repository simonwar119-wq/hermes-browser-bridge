// Hermes AI Assistant — Service Worker v3.0
// 功能：点击图标打开侧边栏、上下文菜单、页面内容获取、Bridge WebSocket 连接

// ============================================================
// 配置
// ============================================================

const CONFIG = {
  // Bridge 连接
  bridgeHost: '127.0.0.1',
  bridgePort: 8643,
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  keepAliveInterval: 20, // 秒
};

// ============================================================
// 状态
// ============================================================

let ws = null;
let connected = false;
let reconnectAttempts = 0;
let reconnectTimer = null;

// ============================================================
// 点击图标直接打开侧边栏
// ============================================================

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ============================================================
// 上下文菜单
// ============================================================

function ensureContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'hermes-summarize',
      title: '🤖 用 Hermes AI 总结本页',
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id: 'hermes-analyze',
      title: '💬 用 Hermes AI 分析本页',
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id: 'hermes-send-page',
      title: '发送给 Hermes Agent',
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id: 'hermes-send-selection',
      title: '处理选中文字',
      contexts: ['selection'],
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // AI 功能：向侧边栏发消息触发快捷操作
  if (info.menuItemId === 'hermes-summarize') {
    // 先打开侧边栏，再发送动作消息
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (e) { /* 侧边栏可能已打开 */ }
    // 短暂延迟等侧边栏加载完毕
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'quick_action',
        action: 'summarize',
      }).catch(() => {});
    }, 800);
    return;
  }

  if (info.menuItemId === 'hermes-analyze') {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (e) { /* 侧边栏可能已打开 */ }
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'quick_action',
        action: 'analyze',
      }).catch(() => {});
    }, 800);
    return;
  }

  // Bridge 功能 — 需要连接
  if (!connected) {
    console.log('[Hermes] Bridge 未连接');
    return;
  }

  const pageInfo = {
    url: tab?.url || info.pageUrl,
    title: tab?.title || '',
    selectionText: info.selectionText || null,
    timestamp: Date.now(),
  };

  let action = 'ask';
  if (info.menuItemId === 'hermes-send-page') action = 'analyze_page';
  else if (info.menuItemId === 'hermes-send-selection') action = 'process_selection';

  sendToBridge({
    type: 'context_menu_action',
    request_id: generateId(),
    data: { ...pageInfo, action },
  });
});

// ============================================================
// 获取当前页面内容（供侧边栏调用）
// ============================================================

async function getPageContent(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = tab?.url || '';
    if (isRestrictedPage(url)) {
      return {
        text: '',
        title: tab?.title || '',
        url,
        restricted: true,
        reason: 'protected_page',
      };
    }
    let result;
    try {
      result = await chrome.tabs.sendMessage(tabId, {
        type: 'read',
        selector: null,
      });
    } catch (err) {
      await ensureContentScriptInjected(tabId);
      result = await chrome.tabs.sendMessage(tabId, {
        type: 'read',
        selector: null,
      });
    }
    return result || { text: '', title: '', url: '' };
  } catch (err) {
    return {
      text: '',
      title: '',
      url: '',
      unavailable: true,
      reason: 'content_script_unavailable',
      error: err.message || String(err),
    };
  }
}

function isRestrictedPage(url = '') {
  return /^(chrome|chrome-extension|edge|about|brave):\/\//i.test(url) ||
    /^https:\/\/chrome\.google\.com\/webstore\//i.test(url);
}

async function ensureContentScriptInjected(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}

async function debugActivePage() {
  const tab = await ensureActiveTab();
  const url = tab?.url || '';

  if (isRestrictedPage(url)) {
    return {
      ok: false,
      restricted: true,
      url,
      title: tab?.title || '',
      reason: 'protected_page',
    };
  }

  let ping = null;
  let debug = null;
  let injectionAttempted = false;

  try {
    ping = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
  } catch (err) {
    injectionAttempted = true;
    await ensureContentScriptInjected(tab.id);
    ping = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
  }

  try {
    debug = await chrome.tabs.sendMessage(tab.id, { type: 'debug_page' });
  } catch (err) {
    debug = { ok: false, error: err.message || String(err) };
  }

  return {
    ok: true,
    restricted: false,
    injectionAttempted,
    url,
    title: tab?.title || '',
    ping,
    debug,
  };
}

// ============================================================
// WebSocket Bridge 管理
// ============================================================

async function getBridgeUrl() {
  const { bridgeHost } = await chrome.storage.local.get(['bridgeHost']);
  return `ws://${bridgeHost || CONFIG.bridgeHost}:${CONFIG.bridgePort}/extension`;
}

async function bridgeConnect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const url = await getBridgeUrl();
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[Hermes] ✅ Bridge 已连接');
    connected = true;
    reconnectAttempts = 0;
    notifySidePanel({ type: 'bridge_status', connected: true });
  };

  ws.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      await handleBridgeMessage(message);
    } catch (err) {
      console.log('[Hermes] Bridge 消息解析失败:', err);
    }
  };

  ws.onclose = () => {
    console.log('[Hermes] ❌ Bridge 已断开');
    connected = false;
    ws = null;
    notifySidePanel({ type: 'bridge_status', connected: false });
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose 会在 error 后触发，这里忽略
  };
}

function bridgeDisconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
  connected = false;
  reconnectAttempts = 0;
  clearTimeout(reconnectTimer);
  notifySidePanel({ type: 'bridge_status', connected: false });
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  const delay = Math.min(
    CONFIG.reconnectBaseDelay * Math.pow(2, reconnectAttempts),
    CONFIG.reconnectMaxDelay
  );
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => { bridgeConnect(); }, delay);
}

// ============================================================
// Bridge 消息处理（来自 Hermes Agent 的浏览器命令）
// ============================================================

async function handleBridgeMessage(message) {
  const { type, action, params, request_id } = message;

  if (type === 'pong') return;
  if (type === 'ping') {
    sendToBridge({ type: 'pong' });
    return;
  }

  if (type === 'browser_action' || action) {
    const rid = request_id || generateId();
    try {
      const result = await executeBrowserAction(action || type, params || {});
      sendToBridge({
        type: 'browser_action_response',
        request_id: rid,
        status: 'ok',
        data: result,
      });
    } catch (err) {
      sendToBridge({
        type: 'browser_action_response',
        request_id: rid,
        status: 'error',
        error: err.message || String(err),
      });
    }
    return;
  }

  console.log('[Hermes] 未知消息类型:', type);
}

function sendToBridge(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ============================================================
// 浏览器操作（供 Hermes Agent 使用）
// ============================================================

async function executeBrowserAction(action, params) {
  switch (action) {
    case 'navigate': return await actionNavigate(params);
    case 'read': return await actionRead(params);
    case 'click': return await actionClick(params);
    case 'fill': return await actionFill(params);
    case 'select': return await actionSelect(params);
    case 'screenshot': return await actionScreenshot(params);
    case 'extract': return await actionExtract(params);
    case 'scroll': return await actionScroll(params);
    case 'get_tabs': return await actionGetTabs();
    case 'activate_tab': return await actionActivateTab(params);
    case 'wait': return await actionWait(params);
    case 'get_active_tab': return await getActiveTab();
    case 'inject': return await actionInject(params);
    case 'reload_and_inject': return await actionReloadAndInject(params);
    case 'scan_forms': return await actionScanForms();
    case 'read_structured': return await actionReadStructured();
    default: throw new Error(`Unknown action: ${action}`);
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs.length > 0 ? tabs[0] : null;
}

async function ensureActiveTab() {
  const tab = await getActiveTab();
  if (!tab) throw new Error('No active tab found');
  return tab;
}

async function actionNavigate(params) {
  const url = params.url;
  if (!url) throw new Error('URL required');
  let tab = await getActiveTab();
  if (!tab) {
    tab = await chrome.tabs.create({ url });
  } else {
    await chrome.tabs.update(tab.id, { url, active: true });
  }
  await waitForTabLoad(tab.id);
  const updated = await chrome.tabs.get(tab.id);
  return { url: updated.url, title: updated.title, status: updated.status };
}

async function actionRead(params) {
  const tab = await ensureActiveTab();
  const result = await chrome.tabs.sendMessage(tab.id, { type: 'read', selector: params.selector || null });
  return result;
}

async function actionClick(params) {
  const tab = await ensureActiveTab();
  if (!params.selector) throw new Error('Selector required');
  return await chrome.tabs.sendMessage(tab.id, { type: 'click', selector: params.selector });
}

async function actionFill(params) {
  const tab = await ensureActiveTab();
  if (!params.selector) throw new Error('Selector required');
  return await chrome.tabs.sendMessage(tab.id, { type: 'fill', selector: params.selector, value: params.value || '', humanLike: params.humanLike !== false });
}

async function actionSelect(params) {
  const tab = await ensureActiveTab();
  if (!params.selector) throw new Error('Selector required');
  return await chrome.tabs.sendMessage(tab.id, {
    type: 'select',
    selector: params.selector,
    value: params.value ?? '',
  });
}

async function actionScreenshot(params) {
  const format = params.format || 'png';

  // 用 lastFocusedWindow 找到网页所在窗口（排除侧边栏干扰）
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab) throw new Error('无法定位当前窗口，请确保有网页标签页处于激活状态');

  // Chrome 系统保护页面（webstore / chrome:// 等）无法截图，属浏览器安全限制
  if (isRestrictedPage(tab.url || '')) {
    throw new Error(
      'Chrome 受保护页面（如 Web Store / chrome:// 页面）不允许扩展截图。\n' +
      '请改用系统截图工具：Mac 按 ⌘⇧4，Windows 按 Win+Shift+S。'
    );
  }

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format });
    return { image: dataUrl, format };
  } catch (err) {
    // activeTab 未激活时的 fallback 提示
    if (err.message?.includes('activeTab')) {
      throw new Error('请先点击页面内任意位置（激活标签页），再点截图按钮。');
    }
    throw err;
  }
}

async function actionExtract(params) {
  const tab = await ensureActiveTab();
  return await chrome.tabs.sendMessage(tab.id, { type: 'extract', selectors: params.selectors || {} });
}

async function actionScroll(params) {
  const tab = await ensureActiveTab();
  return await chrome.tabs.sendMessage(tab.id, { type: 'scroll', direction: params.direction || 'down', amount: params.amount || null });
}

async function actionGetTabs() {
  const tabs = await chrome.tabs.query({});
  return { tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active })) };
}

async function actionActivateTab(params) {
  await chrome.tabs.update(params.tabId, { active: true });
  await waitForTabLoad(params.tabId);
  const tab = await chrome.tabs.get(params.tabId);
  return { id: tab.id, url: tab.url, title: tab.title };
}

async function actionWait(params) {
  const ms = params.ms || 1000;
  await new Promise(r => setTimeout(r, ms));
  return { waited: ms };
}

async function actionInject(params) {
  const tab = await ensureActiveTab();
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
    return { injected: true, tabId: tab.id };
  } catch (err) {
    return { injected: false, reason: 'content script not responding' };
  }
}

async function actionReloadAndInject(params) {
  const tab = await ensureActiveTab();
  await chrome.tabs.reload(tab.id);
  await waitForTabLoad(tab.id);
  return { reloaded: true, tabId: tab.id };
}

async function actionScanForms() {
  const tab = await ensureActiveTab();
  return await chrome.tabs.sendMessage(tab.id, { type: 'scan_forms' });
}

async function actionReadStructured() {
  const tab = await ensureActiveTab();
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'read_structured' });
  } catch (err) {
    // 内容脚本未就绪时降级为普通读取
    return await chrome.tabs.sendMessage(tab.id, { type: 'read', selector: null });
  }
}

function waitForTabLoad(tabId, timeout = 15000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve({ timeout: true });
    }, timeout);
    const listener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(() => resolve({ loaded: true }), 500);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ============================================================
// Service Worker 保活
// ============================================================

function ensureKeepAlive() {
  if (!chrome.alarms) return;
  chrome.alarms.create('hermes-keepalive', { periodInMinutes: CONFIG.keepAliveInterval / 60 });
}

if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'hermes-keepalive') {
      if (!connected && ws === null) {
        chrome.storage.local.get(['autoConnect'], ({ autoConnect }) => {
          if (autoConnect) bridgeConnect();
        });
      }
    }
  });
}

// ============================================================
// 消息路由（接收 Side Panel 请求）
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      const result = await handleMessage(message, sender);
      sendResponse(result || {});
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();
  return true; // 保持 sendResponse 可用
});

async function handleMessage(message, sender) {
  switch (message.type) {

    // === 页面内容获取 ===
    case 'get_page_content': {
      // 获取当前活动标签页的内容
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) return { text: '', title: '', url: '' };
      return await getPageContent(tabId);
    }

    // === 打开侧边栏 ===
    case 'open_side_panel': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.sidePanel.open({ windowId: tabs[0].windowId });
      }
      return { success: true };
    }

    // === Bridge 连接管理 ===
    case 'check_bridge': {
      return { connected };
    }

    case 'bridge_connect': {
      await bridgeConnect();
      await new Promise(r => setTimeout(r, 1500));
      return { connected };
    }

    case 'bridge_disconnect': {
      bridgeDisconnect();
      return { connected: false };
    }

    case 'get_connection_status': {
      return { connected };
    }

    // 侧边栏直接执行浏览器操作（无需 Bridge）
    case 'execute_action': {
      return await executeBrowserAction(message.action, message.params || {});
    }

    case 'debug_page_access': {
      return await debugActivePage();
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

// ============================================================
// 通知侧边栏
// ============================================================

function notifySidePanel(data) {
  try {
    chrome.runtime.sendMessage(data).catch(() => {});
  } catch (e) {
    // 侧边栏未打开时忽略
  }
}

// ============================================================
// 初始化
// ============================================================

ensureKeepAlive();
ensureContextMenus();
console.log('[Hermes AI Assistant] v3.0 loaded');
