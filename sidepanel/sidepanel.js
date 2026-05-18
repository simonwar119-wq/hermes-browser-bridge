// Hermes Browser Bridge — Side Panel v1.1
// 类似 Claude for Chrome 的界面风格 — 实时显示连接状态、当前页面、操作日志

const STATUS_DOT = document.getElementById('statusDot');
const STATUS_LABEL = document.getElementById('statusLabel');
const STATUS_BADGE = document.getElementById('statusBadge');
const TAB_TITLE = document.getElementById('tabTitle');
const TAB_URL = document.getElementById('tabUrl');
const ACTION_LOG = document.getElementById('actionLog');
const BTN_CONNECT = document.getElementById('btnConnect');
const BTN_DISCONNECT = document.getElementById('btnDisconnect');
const BTN_SUMMARIZE = document.getElementById('btnSummarize');
const BTN_REFRESH = document.getElementById('btnRefresh');
const BTN_CLEAR = document.getElementById('btnClearLog');

const MAX_LOG_ENTRIES = 50;
let actionHistory = [];

// ============================================================
// 初始化
// ============================================================

async function init() {
  // 查询当前连接状态
  chrome.runtime.sendMessage({ type: 'get_connection_status' }, (status) => {
    updateConnectionUI(status?.connected || false);
  });

  // 查询当前标签页
  updateTabInfo();

  // 从存储恢复操作日志
  chrome.storage.local.get(['actionHistory'], (items) => {
    if (items.actionHistory) {
      actionHistory = items.actionHistory.slice(-MAX_LOG_ENTRIES);
      renderActionLog();
    }
  });
}

// ============================================================
// 连接控制
// ============================================================

BTN_CONNECT.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'connect' }, (status) => {
    updateConnectionUI(status?.connected || false);
  });
});

BTN_DISCONNECT.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'disconnect' }, () => {
    updateConnectionUI(false);
  });
});

BTN_SUMMARIZE.addEventListener('click', () => {
  // 发送总结指令到 background
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const tab = tabs[0];
      // 通过 storage 传递指令给 Hermes Agent bridge server
      chrome.storage.local.set({
        hermesCommand: {
          type: 'summarize',
          url: tab.url,
          title: tab.title,
          timestamp: Date.now(),
        }
      }, () => {
        addLogEntry('summarize', 'ok', '总结指令已发送');
      });
    }
  });
});

BTN_REFRESH.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.reload(tabs[0].id);
      addLogEntry('refresh', 'ok', '页面已刷新');
    }
  });
});

BTN_CLEAR.addEventListener('click', () => {
  actionHistory = [];
  chrome.storage.local.remove('actionHistory');
  renderActionLog();
});

// ============================================================
// UI 更新
// ============================================================

function updateConnectionUI(connected) {
  STATUS_DOT.className = 'dot ' + (connected ? 'connected' : 'disconnected');
  STATUS_LABEL.textContent = connected ? 'Connected' : 'Disconnected';
  BTN_CONNECT.disabled = connected;
  BTN_DISCONNECT.disabled = !connected;
}

async function updateTabInfo() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const tab = tabs[0];
      TAB_TITLE.textContent = tab.title || 'Untitled';
      TAB_URL.textContent = tab.url || '';
    } else {
      TAB_TITLE.textContent = '无活跃标签页';
      TAB_URL.textContent = '';
    }
  } catch (e) {
    TAB_TITLE.textContent = '无法获取标签页信息';
  }
}

function addLogEntry(action, status, message) {
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    action,
    status,
    message: message || action,
    time: new Date().toLocaleTimeString(),
  };

  actionHistory.push(entry);
  if (actionHistory.length > MAX_LOG_ENTRIES) {
    actionHistory = actionHistory.slice(-MAX_LOG_ENTRIES);
  }

  // 保存到 storage
  chrome.storage.local.set({ actionHistory });

  renderActionLog();
}

function renderActionLog() {
  if (actionHistory.length === 0) {
    ACTION_LOG.innerHTML = '<div class="empty-state">暂无操作记录</div>';
    return;
  }

  ACTION_LOG.innerHTML = actionHistory.map(entry => `
    <div class="action-item">
      <span class="action-icon">${getActionIcon(entry.action)}</span>
      <span class="action-name">${escapeHtml(entry.message)}</span>
      <span class="action-status ${entry.status}">${entry.status === 'ok' ? '✓' : '✕'}</span>
      <span class="action-time">${entry.time}</span>
    </div>
  `).join('');

  // 滚动到底部
  ACTION_LOG.scrollTop = ACTION_LOG.scrollHeight;
}

function getActionIcon(action) {
  const icons = {
    connect: '🔗',
    disconnect: '⛓️',
    navigate: '🌐',
    click: '👆',
    fill: '✏️',
    screenshot: '📸',
    scroll: '📜',
    read: '📖',
    extract: '🔍',
    summarize: '📝',
    refresh: '🔄',
    analyze_page: '🔬',
    process_selection: '✂️',
  };
  return icons[action] || '⚡';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
// 监听来自 background 的消息
// ============================================================

chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'connection_status':
      updateConnectionUI(message.connected);
      break;

    case 'action_completed':
      addLogEntry(message.action, message.status, `${message.action} ${message.status}`);
      break;

    case 'context_menu_result':
      if (message.success) {
        addLogEntry(message.action, 'ok', message.message);
      } else {
        addLogEntry('error', 'error', message.error);
      }
      break;

    case 'tab_changed':
      if (message.data) {
        TAB_TITLE.textContent = message.data.title || 'Untitled';
        TAB_URL.textContent = message.data.url || '';
      }
      break;
  }
});

// 定期刷新标签页信息
setInterval(updateTabInfo, 5000);

// ============================================================
// 启动
// ============================================================

init();
