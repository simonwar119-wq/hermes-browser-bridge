// Hermes Browser Bridge — Service Worker
// 负责: WebSocket连接管理 ↔ 消息路由到Content Script ↔ Hermes Agent通信

const CONFIG = {
  bridgeHost: '127.0.0.1',
  bridgePort: 8643,         // WebSocket端口 (HTTP API在8642)
  reconnectDelay: 3000,     // 重连等待(ms)
  responseTimeout: 30000,   // 命令超时(ms)
};

let ws = null;
let pendingRequests = new Map();     // requestId -> {resolve, reject, timer}
let activeTabId = null;
let connected = false;
let reconnectTimer = null;
let keepAliveTimer = null;

// ============================================================
// WebSocket 连接管理
// ============================================================

async function getBridgeUrl() {
  // WebSocket 端口固定为 CONFIG.bridgePort (8643)
  // 不从 chrome.storage 读端口 — 用户弹窗存的是 HTTP API 端口 (8642)
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
    console.log('[Hermes Bridge] Connected');
    connected = true;
    updateBadge('ON');
    clearTimeout(reconnectTimer);
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
    connected = false;
    updateBadge('');
    rejectAllPending('Bridge disconnected');
    ws = null;
    scheduleReconnect();
  };

  // 不输出 onerror 日志 — 服务器未启动时会产生大量 ERR_CONNECTION_REFUSED
  ws.onerror = () => {};
}

function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
  connected = false;
  updateBadge('');
  clearTimeout(reconnectTimer);
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    console.log('[Hermes Bridge] Attempting reconnect...');
    connect();
  }, CONFIG.reconnectDelay);
}

// ============================================================
// 消息路由
// ============================================================

async function handleBridgeMessage(message) {
  const { type, action, params, request_id } = message;

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

// --- 注入内容脚本到当前页面 ---
// 注：content.js 已通过 manifest.json content_scripts 自动注入
// 此函数仅用于确认通信通道已建立

async function actionInject(params) {
  const tab = await ensureActiveTab();
  try {
    // 尝试发送 ping 确认 content.js 已加载
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
    return { injected: true, tabId: tab.id, url: tab.url };
  } catch (err) {
    return { injected: false, reason: 'content script not responding', tabId: tab.id };
  }
}

// --- 刷新页面 + 确保内容脚本 ---

async function actionReloadAndInject(params) {
  const tab = await ensureActiveTab();
  await chrome.tabs.reload(tab.id);
  await waitForTabLoad(tab.id);
  return { reloaded: true, tabId: tab.id };
}

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
      resolve({ timeout: true });  // 超时但仍返回
    }, timeout);

    const listener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        // 额外等待让页面完全渲染
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

// ============================================================
// 扩展生命周期事件
// ============================================================

// 自动连接 + 迁移: SW 每次启动都执行，不依赖 install/activate 事件
(function autoInit() {
  // 迁移: 清除存储里可能错误的端口值
  chrome.storage.local.get(['bridgePort'], (items) => {
    if (items.bridgePort && items.bridgePort !== '8643') {
      chrome.storage.local.remove('bridgePort');
    }
  });

  // 自动连接
  setTimeout(() => connect(), 500);

  // 周期心跳: 保持连接存活 + 防止 Chrome 回收 SW
  keepAliveTimer = setInterval(() => {
    if (connected && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    } else if (!connected) {
      connect();
    }
  }, 25000);
})();

// 监听来自 popup 的连接/断开请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'connect') {
    connect();
    sendResponse({ connected: true });
  } else if (message.type === 'disconnect') {
    disconnect();
    sendResponse({ connected: false });
  } else if (message.type === 'get_connection_status') {
    sendResponse({ connected, wsReady: ws?.readyState === WebSocket.OPEN });
  }
  return true;
});
