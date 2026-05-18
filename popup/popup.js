// Hermes Browser Bridge — Popup UI v1.1

const CONNECT_BTN = document.getElementById('connectBtn');
const DISCONNECT_BTN = document.getElementById('disconnectBtn');
const STATUS_DOT = document.getElementById('statusDot');
const STATUS_TEXT = document.getElementById('statusText');
const RECONNECT_INFO = document.getElementById('reconnectInfo');
const TAB_INFO = document.getElementById('tabInfo');
const TAB_DETAIL = document.getElementById('tabDetail');
const LOG = document.getElementById('log');
const HOST_INPUT = document.getElementById('bridgeHost');
const PORT_INPUT = document.getElementById('bridgePort');
const BTN_SUMMARIZE = document.getElementById('btnSummarize');
const BTN_ANALYZE = document.getElementById('btnAnalyze');

// ============================================================
// 状态初始化
// ============================================================

async function init() {
  // 加载保存的配置
  const saved = await chrome.storage.local.get(['bridgeHost', 'bridgePort']);
  if (saved.bridgePort && saved.bridgePort !== '8643') {
    // 修复旧版存了 HTTP 端口(8642)的配置
    await chrome.storage.local.remove('bridgePort');
    PORT_INPUT.value = '8643';
  } else if (saved.bridgePort) {
    PORT_INPUT.value = saved.bridgePort;
  }
  if (saved.bridgeHost) HOST_INPUT.value = saved.bridgeHost;

  // 查询当前连接状态
  chrome.runtime.sendMessage({ type: 'get_connection_status' }, (status) => {
    updateStatus(status?.connected || false);
  });

  // 查询当前标签页
  updateTabInfo();
}

// ============================================================
// 连接/断开控制
// ============================================================

CONNECT_BTN.addEventListener('click', async () => {
  // 保存配置
  await chrome.storage.local.set({
    bridgeHost: HOST_INPUT.value,
    bridgePort: PORT_INPUT.value,
  });

  chrome.runtime.sendMessage({ type: 'connect' }, (status) => {
    addLog(status?.connected ? '✅ Connected to bridge server' : '❌ Connection failed');
    updateStatus(status?.connected || false);
  });
});

DISCONNECT_BTN.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'disconnect' }, (status) => {
    addLog('🔌 Disconnected');
    updateStatus(false);
  });
});

// ============================================================
// 快捷操作
// ============================================================

BTN_SUMMARIZE.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    const tab = tabs[0];
    chrome.storage.local.set({
      hermesCommand: {
        type: 'summarize',
        url: tab.url,
        title: tab.title,
        timestamp: Date.now(),
      }
    });
    addLog('📝 总结指令已发送到 Hermes Agent');
    window.close(); // 关闭 popup
  }
});

BTN_ANALYZE.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    const tab = tabs[0];
    chrome.storage.local.set({
      hermesCommand: {
        type: 'analyze_page',
        url: tab.url,
        title: tab.title,
        timestamp: Date.now(),
      }
    });
    addLog('🔬 分析指令已发送到 Hermes Agent');
    window.close();
  }
});

// ============================================================
// 自动刷新状态
// ============================================================

setInterval(async () => {
  chrome.runtime.sendMessage({ type: 'get_connection_status' }, (status) => {
    if (status) updateStatus(status.connected);
  });
}, 3000);

// ============================================================
// UI 更新
// ============================================================

function updateStatus(connected) {
  STATUS_DOT.className = 'status-dot ' + (connected ? 'connected' : 'disconnected');
  STATUS_TEXT.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
  CONNECT_BTN.disabled = connected;
  CONNECT_BTN.classList.toggle('connected', connected);
  DISCONNECT_BTN.disabled = !connected;

  // 更新快捷按钮状态
  BTN_SUMMARIZE.style.opacity = connected ? '1' : '0.4';
  BTN_ANALYZE.style.opacity = connected ? '1' : '0.4';

  if (!connected) {
    RECONNECT_INFO.textContent = '自动重连中...';
  } else {
    RECONNECT_INFO.textContent = '';
  }
}

async function updateTabInfo() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const tab = tabs[0];
      const title = (tab.title || 'Untitled').slice(0, 40);
      const url = (tab.url || '').slice(0, 50);
      TAB_DETAIL.textContent = `📄 ${title}\n${url}`;
    } else {
      TAB_DETAIL.textContent = '❌ 无活跃标签页';
    }
  } catch (e) {
    TAB_DETAIL.textContent = '⚠️ 无法获取标签页信息';
  }
}

function addLog(msg) {
  const time = new Date().toLocaleTimeString();
  LOG.textContent = `[${time}] ${msg}`;
}

// ============================================================
// 启动
// ============================================================

init();
