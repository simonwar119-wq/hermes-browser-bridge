// Hermes AI Assistant — Popup v3.1

const pageTitleEl = document.getElementById('pageTitle');
const pageUrlEl   = document.getElementById('pageUrl');
const openBtn     = document.getElementById('openSidePanel');
const bridgeDot   = document.getElementById('bridgeDot');
const bridgeStat  = document.getElementById('bridgeStatus');
const connectBtn  = document.getElementById('bridgeConnectBtn');
const disconnBtn  = document.getElementById('bridgeDisconnectBtn');

async function init() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const tab = tabs[0];
      pageTitleEl.textContent = (tab.title || '未知页面').slice(0, 50);
      pageUrlEl.textContent   = (tab.url  || '').slice(0, 55);
    }
  } catch (e) {
    pageTitleEl.textContent = '无法获取页面信息';
  }

  try {
    const res = await chrome.runtime.sendMessage({ type: 'check_bridge' });
    updateBridgeUI(res?.connected || false);
  } catch (e) {
    updateBridgeUI(false);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'bridge_status') updateBridgeUI(msg.connected);
  });
}

function updateBridgeUI(connected) {
  bridgeDot.className  = 'dot ' + (connected ? 'on' : 'off');
  bridgeStat.textContent = connected ? 'Bridge 已连接' : 'Bridge 未连接';
  connectBtn.disabled  = connected;
  disconnBtn.disabled  = !connected;
}

openBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'open_side_panel' });
  window.close();
});

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true;
  connectBtn.textContent = '连接中...';
  try {
    const res = await chrome.runtime.sendMessage({ type: 'bridge_connect' });
    updateBridgeUI(res?.connected || false);
  } catch (e) {
    updateBridgeUI(false);
  }
  connectBtn.textContent = '连接';
  // updateBridgeUI 已根据连接结果设置好按钮状态，无需再手动处理
});

disconnBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'bridge_disconnect' });
  updateBridgeUI(false);
});

init();
