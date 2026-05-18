// Hermes Browser Bridge — Service Worker v1.1
// 负责: WebSocket连接管理 ↔ 消息路由到Content Script ↔ Hermes Agent通信
// 关键修复: chrome.alarms 持久心跳防止SW被回收 + 指数退避重连

const CONFIG = {
  bridgeHost: '127.0.0.1',
  bridgePort: 8643,         // WebSocket端口 (HTTP API在8642)
  reconnectBaseDelay: 1000, // 初始重连等待(ms)
  reconnectMaxDelay: 30000,  // 最大重连等待(ms)
  responseTimeout: 30000,   // 命令超时(ms)
  keepAliveInterval: 20,    // chrome.alarms 周期(秒) — 保持SW存活
};

let ws = null;
let pendingRequests = new Map();     // requestId -> {resolve, reject, timer}
let activeTabId = null;
let connected = false;
let reconnectAttempts = 0;
let reconnectTimer = null;

// ============================================================
// WebSocket 连接管理
// ============================================================

async function getBridgeUrl() {
  const { bridgeHost } = await chrome.storage.local.get(['bridgeHost']);
  return `ws://${bridgeHost || CONFIG.bridgeHost}:${CONFIG.bridgePort}/extension`;
}

async function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const url = await getBridgeUrl();

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[Hermes Bridge] ✅ Connected');
    connected = true;
    reconnectAttempts = 0;
    updateBadge('ON');
    clearTimeout(reconnectTimer);
    notifyPopup({ type: 'connection_status', connected: true });
  };

  ws.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      await handleBridgeMessage(message);
    } catch (err) {
      console.warn('[Hermes Bridge] Invalid message:', err);
    }
  };

  ws.onclose = (event) => {
    console.log('[Hermes Bridge] ❌ Disconnected (code:', event.code, ')');
    connected = false;
    updateBadge('');
    rejectAllPending('Bridge disconnected');
    ws = null;
    notifyPopup({ type: 'connection_status', connected: false });
    scheduleReconnect();
  };

  ws.onerror = () => {
    // 静默 — 服务器未启动时 ERR_CONNECTION_REFUSED 会触发 onclose
  };
}

function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
  connected = false;
  reconnectAttempts = 0;
  updateBadge('');
  clearTimeout(reconnectTimer);
  notifyPopup({ type: 'connection_status', connected: false });
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  // 指数退避: 1s → 2s → 4s → 8s → 16s → 30s(max)
  const delay = Math.min(
    CONFIG.reconnectBaseDelay * Math.pow(2, reconnectAttempts),
    CONFIG.reconnectMaxDelay
  );
  reconnectAttempts++;
  console.log(`[Hermes Bridge] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
  reconnectTimer = setTimeout(() => {
    connect();
  }, delay);
}

// ============================================================
// Service Worker 保活 — 使用 chrome.alarms（比 setInterval 可靠）
// ============================================================

function ensureKeepAlive() {
  // 创建每20秒唤醒一次 SW 的 alarm
  chrome.alarms.create('hermes-bridge-keepalive', {
    periodInMinutes: CONFIG.keepAliveInterval / 60,  // 20 seconds
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'hermes-bridge-keepalive') {
    // 如果连接断开，尝试重连
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      connect();
    } else {
      // 发送 ping 保活
      try {
        ws.send(JSON.stringify({ type: 'ping' }));
      } catch (e) {
        // ignore
      }
    }
  }
});

// ============================================================
// 消息路由
// ============================================================

async function handleBridgeMessage(message) {
  const { type, action, params, request_id } = message;

  // 心跳响应
  if (type === 'pong') return;

  // 心跳检测
  if (type === 'ping') {
    sendToBridge({ type: 'pong' });
    return;
  }

  // 状态查询
  if (type === 'get_status') {
    sendToBridge({
      type: 'status',
      connected: true,
      activeTabId: activeTabId || null,
    });
    return;
  }

  // 浏览器操作命令
  if (type === 'browser_action' || action) {
    const rid = request_id || generateId();
    try {
      const result = await executeBrowserAction(action || type, params || {});
      // 通知 popup 有操作完成
      notifyPopup({
        type: 'action_completed',
        action: action || type,
        status: 'ok',
        timestamp: Date.now(),
      });
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

  console.warn('[Hermes Bridge] Unknown message type:', type);
}

// ============================================================
// 浏览器操作执行
// ============================================================

async function executeBrowserAction(action, params) {
  switch (action) {
    case 'navigate':
      return await actionNavigate(params);
    case 'read':
      return await actionRead(params);
    case 'click':
      return await actionClick(params);
    case 'fill':
      return await actionFill(params);
    case 'screenshot':
      return await actionScreenshot(params);
    case 'extract':
      return await actionExtract(params);
    case 'scroll':
      return await actionScroll(params);
    case 'get_tabs':
      return await actionGetTabs(params);
    case 'activate_tab':
      return await actionActivateTab(params);
    case 'wait':
      return await actionWait(params);
    case 'get_active_tab':
      return await getActiveTab();
    case 'inject':
      return await actionInject(params);
    case 'reload_and_inject':
      return await actionReloadAndInject(params);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// --- 导航 ---

async function actionNavigate(params) {
  const url = params.url;
  if (!url) throw new Error('URL required');

  let tab = await getActiveTab();
  if (!tab) {
    tab = await chrome.tabs.create({ url });
  } else {
    await chrome.tabs.update(tab.id, { url, active: true });
  }

  // 等待页面加载完成
  await waitForTabLoad(tab.id);

  const updated = await chrome.tabs.get(tab.id);
  activeTabId = updated.id;

  return {
    url: updated.url,
    title: updated.title,
    status: updated.status,
  };
}

// --- 读取页面内容 ---

async function actionRead(params) {
  const tab = await ensureActiveTab();
  const selector = params.selector || null;

  const result = await chrome.tabs.sendMessage(tab.id, {
    type: 'read',
    selector: selector,
  });

  return result;
}

// --- 点击元素 ---

async function actionClick(params) {
  const tab = await ensureActiveTab();
  const selector = params.selector;

  if (!selector) throw new Error('Selector required for click');

  const result = await chrome.tabs.sendMessage(tab.id, {
    type: 'click',
    selector: selector,
    position: params.position || null,
  });

  return result;
}

// --- 填写表单 ---

async function actionFill(params) {
  const tab = await ensureActiveTab();
  const { selector, value } = params;
  if (!selector) throw new Error('Selector required for fill');

  const result = await chrome.tabs.sendMessage(tab.id, {
    type: 'fill',
    selector: selector,
    value: value || '',
    humanLike: params.humanLike !== false,
  });

  return result;
}

// --- 截图 ---

async function actionScreenshot(params) {
  const format = params.format || 'png';
  const dataUrl = await chrome.tabs.captureVisibleTab(null, { format });

  return { image: dataUrl, format };
}

// --- 提取结构化数据 ---

async function actionExtract(params) {
  const tab = await ensureActiveTab();
  const selectors = params.selectors || {};

  const result = await chrome.tabs.sendMessage(tab.id, {
    type: 'extract',
    selectors: selectors,
  });

  return result;
}

// --- 滚动 ---

async function actionScroll(params) {
  const tab = await ensureActiveTab();

  const result = await chrome.tabs.sendMessage(tab.id, {
    type: 'scroll',
    direction: params.direction || 'down',
    amount: params.amount || null,
  });

  return result;
}

// --- 标签页管理 ---

async function actionGetTabs() {
  const tabs = await chrome.tabs.query({});
  return {
    tabs: tabs.map(t => ({
      id: t.id,
      title: t.title,
      url: t.url,
      active: t.active,
    })),
  };
}

async function actionActivateTab(params) {
  const tabId = params.tabId;
  await chrome.tabs.update(tabId, { active: true });
  await waitForTabLoad(tabId);
  const tab = await chrome.tabs.get(tabId);
  activeTabId = tab.id;
  return { id: tab.id, url: tab.url, title: tab.title };
}

// --- 等待 ---

async function actionWait(params) {
  const ms = params.ms || 1000;
  await sleep(ms);
  return { waited: ms };
}

// --- 注入检查 ---

async function actionInject(params) {
  const tab = await ensureActiveTab();
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
    return { injected: true, tabId: tab.id, url: tab.url };
  } catch (err) {
    return { injected: false, reason: 'content script not responding', tabId: tab.id };
  }
}

// --- 刷新页面 ---

async function actionReloadAndInject(params) {
  const tab = await ensureActiveTab();
  await chrome.tabs.reload(tab.id);
  await waitForTabLoad(tab.id);
  return { reloaded: true, tabId: tab.id };
}

// ============================================================
// 上下文菜单（类似 Claude for Chrome）
// ============================================================

function ensureContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'hermes-send-page',
      title: '让 Hermes 分析当前页面',
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id: 'hermes-send-selection',
      title: '让 Hermes 处理选中文字',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'hermes-ask-page',
      title: '向 Hermes 提问当前页面',
      contexts: ['link', 'image', 'video', 'audio'],
    });
    chrome.contextMenus.create({
      id: 'hermes-summarize',
      title: '让 Hermes 总结本页',
      contexts: ['page'],
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!connected) {
    notifyPopup({ type: 'context_menu_result', success: false, error: '未连接到 Bridge Server' });
    return;
  }

  let action = 'ask';
  if (info.menuItemId === 'hermes-send-page') {
    action = 'analyze_page';
  } else if (info.menuItemId === 'hermes-send-selection') {
    action = 'process_selection';
  } else if (info.menuItemId === 'hermes-summarize') {
    action = 'summarize';
  }

  // 收集页面信息
  const pageInfo = {
    action,
    url: tab?.url || info.pageUrl,
    title: tab?.title || '',
    selectionText: info.selectionText || null,
    tabId: tab?.id || null,
    timestamp: Date.now(),
  };

  // 通过 WebSocket 发送给 Bridge Server（递送给 Hermes Agent）
  sendToBridge({
    type: 'context_menu_action',
    request_id: generateId(),
    data: pageInfo,
  });

  notifyPopup({
    type: 'context_menu_result',
    success: true,
    action,
    message: `已发送给 Hermes: ${action === 'summarize' ? '总结此页' : action === 'analyze_page' ? '分析页面' : '处理选中文字'}`,
  });
});

// ============================================================
// Side Panel 支持
// ============================================================

// 不设置 openPanelOnActionClick（保留 popup 为主界面）
// 用户可通过扩展图标右键菜单 → "Open side panel" 打开

// ============================================================
// 辅助函数
// ============================================================

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    activeTabId = tabs[0].id;
    return tabs[0];
  }
  return null;
}

async function ensureActiveTab() {
  let tab = await getActiveTab();
  if (!tab) {
    throw new Error('No active tab found. Open a page first.');
  }
  return tab;
}

function waitForTabLoad(tabId, timeout = 15000) {
  return new Promise((resolve, reject) => {
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

function sendToBridge(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  } else {
    console.warn('[Hermes Bridge] Cannot send: not connected');
  }
}

function updateBadge(text) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: text === 'ON' ? '#22c55e' : '#6b7280' });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateId() {
  return 'rq_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function rejectAllPending(reason) {
  for (const [id, req] of pendingRequests) {
    clearTimeout(req.timer);
    req.reject(new Error(reason));
  }
  pendingRequests.clear();
}

// 通知所有打开的 popup/sidepanel
function notifyPopup(data) {
  chrome.runtime.sendMessage(data).catch(() => {
    // popup 未打开时忽略错误
  });
}

// 主动获取当前标签页信息并推送给 bridge server
async function notifyActiveTab() {
  try {
    const tab = await getActiveTab();
    if (tab && connected) {
      sendToBridge({
        type: 'tab_changed',
        data: {
          url: tab.url,
          title: tab.title,
          tabId: tab.id,
        },
      });
    }
  } catch (e) {
    // ignore
  }
}

// ============================================================
// 扩展生命周期事件
// ============================================================

// 安装/更新时注册菜单和保活
chrome.runtime.onInstalled.addListener(() => {
  ensureKeepAlive();
  ensureContextMenus();
});

// 自动初始化
(function autoInit() {
  // 清除旧端口配置
  chrome.storage.local.get(['bridgePort'], (items) => {
    if (items.bridgePort && items.bridgePort !== '8643') {
      chrome.storage.local.remove('bridgePort');
    }
  });

  // 确保保活机制
  ensureKeepAlive();
  ensureContextMenus();

  // 延迟连接（给 SW 足够时间初始化）
  setTimeout(() => connect(), 500);
})();

// 监听来自 popup/sidepanel 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'connect':
      connect();
      sendResponse({ connected: true });
      break;
    case 'disconnect':
      disconnect();
      sendResponse({ connected: false });
      break;
    case 'get_connection_status':
      sendResponse({ connected, wsReady: ws?.readyState === WebSocket.OPEN });
      break;
    case 'get_active_tab_info':
      getActiveTab().then(tab => {
        sendResponse(tab ? { url: tab.url, title: tab.title, id: tab.id } : null);
      }).catch(() => sendResponse(null));
      return true; // 异步响应
  }
  return true;
});

// 监听标签页切换，通知 bridge server
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  notifyActiveTab();
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.status === 'complete') {
    notifyActiveTab();
  }
});
