// Hermes Browser Bridge — Popup UI

const CONNECT_BTN = document.getElementById('connectBtn');
const DISCONNECT_BTN = document.getElementById('disconnectBtn');
const STATUS_DOT = document.getElementById('statusDot');
const STATUS_TEXT = document.getElementById('statusText');
const TAB_INFO = document.getElementById('tabInfo');
const LOG = document.getElementById('log');
const HOST_INPUT = document.getElementById('bridgeHost');
const PORT_INPUT = document.getElementById('bridgePort');

// ============================================================
// 状态初始化
// ============================================================

async function init() {
  // 加载保存的配置
  const saved = await chrome.storage.local.get(['bridgeHost', 'bridgePort']);
  if (saved.bridgeHost) HOST_INPUT.value = saved.bridgeHost;
  if (saved.bridgePort) PORT_INPUT.value = saved.bridgePort;

  // 查询当前连接状态
  const bg = chrome.runtime.getBackgroundPage ? await chrome.runtime.getBackgroundPage() : null;
  chrome.runtime.sendMessage({ type: 'get_connection_status' }, (status) => {
    updateStatus(status?.connected || false);
  });

  // 查询当前标签页
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    const tab = tabs[0];
    TAB_INFO.textContent = `📄 ${tab.title?.slice(0, 40) || 'Untitled'} — ${tab.url?.slice(0, 50)}`;
  }
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
    addLog(status?.connected ? 'Connected to bridge server' : 'Connection failed');
    updateStatus(status?.connected || false);
  });
});

DISCONNECT_BTN.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'disconnect' }, (status) => {
    addLog('Disconnected');
    updateStatus(false);
  });
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
  STATUS_TEXT.textContent = connected ? 'Connected' : 'Disconnected';
  CONNECT_BTN.disabled = connected;
  CONNECT_BTN.classList.toggle('connected', connected);
  DISCONNECT_BTN.disabled = !connected;

  if (connected) {
    addLog('Status: connected');
  }
}

function addLog(msg) {
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] ${msg}`;
  LOG.textContent = line;
}

// ============================================================
// 启动
// ============================================================

init();
