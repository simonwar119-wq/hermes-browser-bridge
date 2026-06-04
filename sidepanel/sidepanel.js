// Hermes AI Assistant — Side Panel v3.1
// 核心功能：多 Provider AI 聊天、页面分析、流式输出、浏览器控制

// ============================================================
// Provider 配置
// ============================================================

const PROVIDERS = {
  deepseek: {
    name: 'DeepSeek', icon: '🟣',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
    format: 'openai',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  openai: {
    name: 'OpenAI', icon: '🟢',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'],
    format: 'openai',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    name: 'Claude', icon: '🔵',
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    format: 'anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  gemini: {
    name: 'Gemini', icon: '🔷',
    // Google 提供 OpenAI 兼容端点，使用 API Key 作为 Bearer token
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    format: 'openai',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  grok: {
    name: 'Grok', icon: '⚡',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    models: ['grok-4', 'grok-4.3', 'grok-3', 'grok-3-mini'],
    format: 'openai',
    keyUrl: 'https://console.x.ai/',
  },
  kimi: {
    name: 'Kimi', icon: '🌙',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    models: ['kimi-k2.5', 'kimi-k2-thinking', 'kimi-k2-thinking-turbo', 'kimi-k2-turbo-preview', 'kimi-k2-0905-preview'],
    format: 'openai',
    keyUrl: 'https://platform.moonshot.cn/console/account',
  },
};

const PROVIDER_ORDER = Object.keys(PROVIDERS);
const DEFAULT_API_KEYS = Object.fromEntries(PROVIDER_ORDER.map((pid) => [pid, '']));

// ============================================================
// 状态变量
// ============================================================

let activeProvider = 'deepseek';
let activeModel    = 'deepseek-v4-flash';
let apiKeys        = { ...DEFAULT_API_KEYS };
let conversationHistory = [];
let pageTitle = '';
let pageUrl = '';
let pageContent = '';
let isRestrictedPageContext = false;
let isPageContentUnavailable = false;
let isStreaming = false;
let attachedFiles = [];
let pastedImages  = [];   // dataURL[]，图片粘贴/上传后存放在此
const SUPPORTED_BROWSER_ACTIONS = new Set(['navigate', 'click', 'fill', 'select', 'scroll', 'read', 'screenshot']);
const MAX_ATTACHMENTS = 20;
const MAX_ATTACHMENT_TEXT_CHARS = 4000;
const MAX_TOTAL_ATTACHMENT_CHARS = 12000;
const MAX_ATTACHMENT_FILE_BYTES = 512 * 1024;
const SKIP_ATTACHMENT_PATH_PATTERNS = [
  /(^|\/)__pycache__(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.next(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)build(\/|$)/,
  /\.map$/i,
  /\.(png|jpg|jpeg|gif|webp|svg|ico|pdf|zip|rar|7z|mp4|mov|mp3|wav|woff2?|ttf|otf|dmg|exe|bin)$/i,
];

// ============================================================
// DOM 元素引用
// ============================================================

const chatArea          = document.getElementById('chatArea');
const welcomeState      = document.getElementById('welcomeState');
const chatInput         = document.getElementById('chatInput');
const sendBtn           = document.getElementById('sendBtn');
const charCount         = document.getElementById('charCount');
const pageTitleEl       = document.getElementById('pageTitle');
const pageUrlEl         = document.getElementById('pageUrl');
const profileBtn        = document.getElementById('profileBtn');
const profileOverlay    = document.getElementById('profileOverlay');
const closeProfileBtn   = document.getElementById('closeProfileBtn');
const saveProfileBtn    = document.getElementById('saveProfileBtn');
const autoFillBtn       = document.getElementById('autoFillBtn');
const fillStatus        = document.getElementById('fillStatus');
const modelBadge        = document.getElementById('modelBadge');
const modelDropdown     = document.getElementById('modelDropdown');
const providerSettingsList = document.getElementById('providerSettingsList');
const settingsBtn       = document.getElementById('settingsBtn');
const closeSettingsBtn  = document.getElementById('closeSettingsBtn');
const settingsOverlay   = document.getElementById('settingsOverlay');
const saveSettingsBtn   = document.getElementById('saveSettingsBtn');
const testProvidersBtn  = document.getElementById('testProvidersBtn');
const providerTestStatus = document.getElementById('providerTestStatus');
const clearBtn          = document.getElementById('clearBtn');
const attachFilesBtn      = document.getElementById('attachFilesBtn');
const attachImageBtn      = document.getElementById('attachImageBtn');
const clearAttachmentsBtn = document.getElementById('clearAttachmentsBtn');
const attachmentList      = document.getElementById('attachmentList');
const attachmentStatus    = document.getElementById('attachmentStatus');
const fileInput           = document.getElementById('fileInput');
const imageFileInput      = document.getElementById('imageFileInput');
const imagePreviewStrip   = document.getElementById('imagePreviewStrip');
const bridgeDot         = document.getElementById('bridgeDot');
const bridgeStatusText  = document.getElementById('bridgeStatusText');
const bridgeConnectBtn  = document.getElementById('bridgeConnectBtn');
const bridgeDisconnectBtn = document.getElementById('bridgeDisconnectBtn');

// ============================================================
// 初始化
// ============================================================

async function init() {
  renderProviderSettings();

  // 1. 读取 storage（支持新旧两种 schema）
  const saved = await chrome.storage.local.get([
    'activeProvider', 'activeModel', 'apiKeys',
    'apiKey', 'model',  // 旧字段，用于迁移
    'conversationHistory',
  ]);

  // 迁移：旧版单 apiKey → apiKeys.deepseek
  if (saved.apiKey && !saved.apiKeys) {
    const migrated = { ...DEFAULT_API_KEYS, deepseek: saved.apiKey };
    await chrome.storage.local.set({ apiKeys: migrated });
    await chrome.storage.local.remove(['apiKey', 'model']);
    saved.apiKeys = migrated;
  }

  apiKeys        = { ...DEFAULT_API_KEYS, ...(saved.apiKeys || {}) };
  activeProvider = saved.activeProvider || 'deepseek';
  activeModel    = saved.activeModel    || 'deepseek-v4-flash';
  conversationHistory = saved.conversationHistory || [];

  // 2. 同步设置面板 API Key 输入框
  for (const pid of PROVIDER_ORDER) {
    const el = document.getElementById(`apiKey_${pid}`);
    if (el) el.value = apiKeys[pid] || '';
  }

  // 3. 初始化 model badge + dropdown
  buildModelDropdown();
  updateModelBadge();
  renderAttachmentList();

  // 4. 更新页面上下文信息
  await updatePageContext();

  // 5. 渲染历史消息
  if (conversationHistory.length > 0) {
    hideWelcome();
    for (const msg of conversationHistory.slice(-20)) {
      appendMessage(msg.role, msg.content, false);
    }
    scrollToBottom();
  }

  // 6. 检查 Bridge 状态
  checkBridgeStatus();

  // 7. 定期刷新页面上下文
  setInterval(updatePageContext, 8000);

  // 8. 监听 service worker 消息
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'bridge_status') updateBridgeUI(msg.connected);
    if (msg.type === 'quick_action')  handleQuickAction(msg.action);
  });
}

// ============================================================
// 页面上下文
// ============================================================

async function updatePageContext() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;
    const tab = tabs[0];

    pageTitle = tab.title || '未知页面';
    pageUrl = tab.url || '';

    pageTitleEl.textContent = pageTitle;
    pageUrlEl.textContent = pageUrl.length > 60
      ? pageUrl.slice(0, 57) + '...'
      : pageUrl;

    // 异步获取页面内容（不阻塞 UI）
    fetchPageContent();
  } catch (e) {
    pageTitleEl.textContent = '无法获取页面信息';
  }
}

async function fetchPageContent() {
  try {
    // 优先使用结构化读取（保留表格/表单结构），不支持时降级
    const result = await chrome.runtime.sendMessage({ type: 'get_page_content' });
    isRestrictedPageContext  = !!result?.restricted;
    isPageContentUnavailable = !!result?.unavailable;
    if (result?.restricted || result?.unavailable) {
      pageContent = '';
      return;
    }
    // 用 read_structured 替换纯文本
    try {
      const structured = await runBrowserAction('read_structured', {});
      pageContent = structured?.text || result?.text || '';
    } catch {
      pageContent = result?.text || '';
    }
  } catch (e) {
    pageContent = '';
    isRestrictedPageContext  = false;
    isPageContentUnavailable = true;
  }
}

function isProtectedPageUrl(url = '') {
  return /^(chrome|chrome-extension|edge|about|brave):\/\//i.test(url) ||
    /^https:\/\/chrome\.google\.com\/webstore\//i.test(url);
}

function getRestrictedPageHelpText() {
  return '当前页面属于 Chrome 受保护页面，扩展无法直接读取 DOM。请改用截图、手动附加说明文档，或把需要填写的字段内容粘贴给我。';
}

function getUnavailablePageHelpText() {
  return '当前普通页面的读取能力还没就绪。我已尝试自动注入读取脚本；如果仍然没有内容，请手动刷新当前网页后再试一次。';
}

// ============================================================
// 模型选择 Badge + Dropdown
// ============================================================

function updateModelBadge() {
  const p = PROVIDERS[activeProvider];
  const hasKey = !!apiKeys[activeProvider];
  modelBadge.textContent = `${p.icon} ${activeModel} ▾`;
  modelBadge.className = 'model-badge' + (hasKey ? '' : ' no-key');
  modelBadge.title = hasKey
    ? `当前：${p.name} / ${activeModel}（点击切换）`
    : `${p.name} 未配置 API Key，请在设置中填写`;
}

function buildModelDropdown() {
  modelDropdown.innerHTML = '';
  for (const pid of PROVIDER_ORDER) {
    const p = PROVIDERS[pid];
    const header = document.createElement('div');
    header.className = 'dropdown-provider';
    header.textContent = `${p.icon} ${p.name}`;
    modelDropdown.appendChild(header);

    for (const m of p.models) {
      const item = document.createElement('div');
      item.className = 'dropdown-item' + (pid === activeProvider && m === activeModel ? ' active' : '');
      item.innerHTML = `<span>${m}</span>${pid === activeProvider && m === activeModel ? '<span class="dropdown-check">✓</span>' : ''}`;
      item.addEventListener('click', () => selectModel(pid, m));
      modelDropdown.appendChild(item);
    }
  }
}

function renderProviderSettings() {
  providerSettingsList.innerHTML = '';

  for (const pid of PROVIDER_ORDER) {
    const provider = PROVIDERS[pid];
    const group = document.createElement('div');
    group.className = 'setting-group';
    group.innerHTML = `
      <label class="setting-label">${provider.icon} ${provider.name} API Key</label>
      <input
        type="password"
        class="setting-input"
        id="apiKey_${pid}"
        placeholder="${getApiKeyPlaceholder(pid)}"
        autocomplete="off"
      />
      <span class="setting-hint">从 <a href="${provider.keyUrl}" target="_blank" style="color:#818cf8">${formatHostLabel(provider.keyUrl)}</a> 获取</span>
    `;
    providerSettingsList.appendChild(group);
  }
}

function getApiKeyPlaceholder(providerId) {
  switch (providerId) {
    case 'anthropic': return 'sk-ant-...';
    case 'gemini': return 'AIza...';
    case 'grok': return 'xai-...';
    default: return 'sk-...';
  }
}

function formatHostLabel(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return url;
  }
}

function getProviderApiKey(providerId = activeProvider) {
  return apiKeys[providerId] || '';
}

function getProviderModel(providerId = activeProvider) {
  if (providerId === activeProvider && activeModel) return activeModel;
  return PROVIDERS[providerId]?.models?.[0] || '';
}

async function selectModel(provider, model) {
  activeProvider = provider;
  activeModel    = model;
  await chrome.storage.local.set({ activeProvider, activeModel });
  buildModelDropdown();
  updateModelBadge();
  closeDropdown();
}

function openDropdown() {
  modelDropdown.hidden = false;
  modelBadge.classList.add('open');
}

function closeDropdown() {
  modelDropdown.hidden = true;
  modelBadge.classList.remove('open');
}

modelBadge.addEventListener('click', (e) => {
  e.stopPropagation();
  modelDropdown.hidden ? openDropdown() : closeDropdown();
});

document.addEventListener('click', () => closeDropdown());
modelDropdown.addEventListener('click', (e) => e.stopPropagation());

// ============================================================
// 浏览器操作（直接控制，无需 Bridge）
// ============================================================

async function runBrowserAction(action, params = {}) {
  const result = await chrome.runtime.sendMessage({
    type: 'execute_action',
    action,
    params,
  });
  if (result?.error) throw new Error(result.error);
  return result;
}

function isTextLikeFile(file) {
  if (file.type?.startsWith('text/')) return true;
  if ([
    'application/json',
    'application/xml',
    'application/javascript',
    'application/x-javascript',
  ].includes(file.type)) return true;

  return /\.(txt|md|markdown|json|jsonl|js|ts|jsx|tsx|html|htm|css|scss|less|xml|yml|yaml|csv|tsv|py|java|kt|go|rs|rb|php|sh|bash|zsh|sql|toml|ini|log)$/i.test(file.name);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shouldSkipAttachment(file) {
  const relativePath = file.webkitRelativePath || file.name;
  return SKIP_ATTACHMENT_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}

async function readTextExcerpt(file) {
  const blob = file.slice(0, MAX_ATTACHMENT_TEXT_CHARS + 1);
  const text = await blob.text();
  return {
    excerpt: text.slice(0, MAX_ATTACHMENT_TEXT_CHARS),
    truncated: file.size > MAX_ATTACHMENT_TEXT_CHARS || text.length > MAX_ATTACHMENT_TEXT_CHARS,
  };
}

async function loadAttachments(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;

  const existingKeys = new Set(attachedFiles.map((file) => file.key));
  const nextFiles = [];
  let skippedCount = 0;

  for (const file of files) {
    if (attachedFiles.length + nextFiles.length >= MAX_ATTACHMENTS) break;
    if (shouldSkipAttachment(file)) {
      skippedCount++;
      continue;
    }

    const relativePath = file.webkitRelativePath || file.name;
    const key = `${relativePath}:${file.size}:${file.lastModified}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);

    const attachment = {
      key,
      name: file.name,
      path: relativePath,
      size: file.size,
      kind: isTextLikeFile(file) && file.size <= MAX_ATTACHMENT_FILE_BYTES ? 'text' : 'binary',
      excerpt: '',
      truncated: false,
    };

    if (attachment.kind === 'text') {
      try {
        const excerptResult = await readTextExcerpt(file);
        attachment.excerpt = excerptResult.excerpt;
        attachment.truncated = excerptResult.truncated;
      } catch (err) {
        attachment.kind = 'binary';
      }
    }

    nextFiles.push(attachment);
  }

  attachedFiles = [...attachedFiles, ...nextFiles];
  renderAttachmentList();

  if (nextFiles.length > 0) {
    attachmentStatus.textContent = `已附加 ${attachedFiles.length} 个项目。${skippedCount > 0 ? `已跳过 ${skippedCount} 个缓存目录或非适合上传的大文件。` : '文本文件内容会随本次消息一起提供给模型。'}`;
  } else if (attachedFiles.length >= MAX_ATTACHMENTS) {
    attachmentStatus.textContent = `最多保留 ${MAX_ATTACHMENTS} 个附件，请先清理后再添加。`;
  } else if (skippedCount > 0) {
    attachmentStatus.textContent = `本次选择的内容都被跳过了：缓存目录、构建产物、图片压缩包或超大文件不会读入模型。`;
  }
}

function removeAttachment(key) {
  attachedFiles = attachedFiles.filter((file) => file.key !== key);
  renderAttachmentList();
}

function clearAttachments() {
  attachedFiles = [];
  fileInput.value = '';
  renderAttachmentList();
}

function renderAttachmentList() {
  attachmentList.innerHTML = '';
  attachmentList.classList.toggle('has-items', attachedFiles.length > 0);
  clearAttachmentsBtn.classList.toggle('visible', attachedFiles.length > 0);

  if (attachedFiles.length === 0) {
    attachmentStatus.textContent = '请优先附加 README、产品说明、合规说明等文本文件，发送时会把内容摘要一并提供给模型。';
    return;
  }

  for (const file of attachedFiles) {
    const item = document.createElement('div');
    item.className = 'attachment-item';

    const meta = document.createElement('div');
    meta.className = 'attachment-meta';
    meta.innerHTML = `
      <div class="attachment-name">${escapeHtml(file.path)}</div>
      <div class="attachment-subline">${file.kind === 'text' ? '文本' : '二进制'} · ${formatFileSize(file.size)}</div>
    `;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'attachment-remove';
    removeBtn.title = '移除附件';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => removeAttachment(file.key));

    item.appendChild(meta);
    item.appendChild(removeBtn);
    attachmentList.appendChild(item);
  }
}

function buildAttachmentPayload(userText) {
  const baseText = userText || '请阅读这些附件并协助我处理。';
  if (attachedFiles.length === 0) {
    return { historyContent: baseText, requestContent: baseText };
  }

  let remaining = MAX_TOTAL_ATTACHMENT_CHARS;
  const historyParts = [];
  const requestParts = [];

  for (const file of attachedFiles) {
    const meta = `${file.path} (${file.kind}, ${formatFileSize(file.size)})`;
    historyParts.push(`- ${meta}`);

    if (file.kind === 'text' && file.excerpt) {
      const excerpt = file.excerpt.slice(0, remaining);
      if (excerpt) {
        requestParts.push(
          `文件: ${file.path}\n内容摘录:\n${excerpt}${file.truncated || excerpt.length < file.excerpt.length ? '\n[内容已截断]' : ''}`
        );
        remaining -= excerpt.length;
      }
    } else {
      requestParts.push(`文件: ${file.path}\n说明: 此文件为非文本内容，仅提供文件名和大小。`);
    }

    if (remaining <= 0) break;
  }

  return {
    historyContent: `${baseText}\n\n[附件]\n${historyParts.join('\n')}`,
    requestContent: `${baseText}\n\n以下是用户附加的文件/文件夹内容，请结合这些材料回答：\n\n${requestParts.join('\n\n')}`,
  };
}

function getPrioritizedAttachmentContext() {
  if (attachedFiles.length === 0) return '';

  const prioritized = [...attachedFiles].sort((a, b) => {
    const aReadme = /(^|\/)readme(\.[^\/]+)?$/i.test(a.path) ? 1 : 0;
    const bReadme = /(^|\/)readme(\.[^\/]+)?$/i.test(b.path) ? 1 : 0;
    if (aReadme !== bReadme) return bReadme - aReadme;
    if (a.kind !== b.kind) return a.kind === 'text' ? -1 : 1;
    return a.path.localeCompare(b.path, 'zh-CN');
  });

  let remaining = MAX_TOTAL_ATTACHMENT_CHARS;
  const sections = [];

  for (const file of prioritized) {
    if (remaining <= 0) break;

    const label = /(^|\/)readme(\.[^\/]+)?$/i.test(file.path) ? 'README 优先上下文' : '补充文件';
    if (file.kind === 'text' && file.excerpt) {
      const excerpt = file.excerpt.slice(0, remaining);
      if (!excerpt) continue;
      sections.push(`### ${label}\n路径: ${file.path}\n内容:\n${excerpt}${file.truncated || excerpt.length < file.excerpt.length ? '\n[内容已截断]' : ''}`);
      remaining -= excerpt.length;
    } else {
      sections.push(`### 二进制附件\n路径: ${file.path}\n说明: 非文本文件，仅供识别文件名和大小 (${formatFileSize(file.size)})。`);
    }
  }

  return sections.join('\n\n');
}

function shouldTryAgentAction(text) {
  return /^(请|帮我|麻烦|直接)?\s*(打开|访问|导航到|点击|填写|输入|选择|勾选|滚动|截图|读取页面|读取当前页面|总结这个页面|分析这个页面|translate this page|summarize this page|analyze this page|go to|navigate to|open|click|fill|select|scroll|read page|take screenshot)/i.test(text.trim());
}

async function inferBrowserAction(userInput) {
  if (!apiKeys[activeProvider]) return null;

  const provider = PROVIDERS[activeProvider];
  const schemaHint = '{"mode":"action|chat","action":"navigate|click|fill|select|scroll|read|screenshot","params":{}}';
  const prompt = [
    '你是浏览器扩展的动作路由器。判断用户消息是否应该直接执行一次浏览器动作。',
    `只返回 JSON，格式: ${schemaHint}`,
    '如果不应执行动作，返回 {"mode":"chat"}。',
    '规则:',
    '- 最多选择一个动作。',
    '- navigate 需要 params.url。',
    '- click 需要 params.selector，可以是 CSS 选择器、XPath 或 text=按钮文本。',
    '- fill 需要 params.selector 和 params.value。',
    '- select 需要 params.selector 和 params.value。',
    '- scroll 可使用 params.direction = "up" 或 "down"。',
    '- read 和 screenshot 不需要额外参数。',
    `当前页面标题: ${pageTitle || ''}`,
    `当前页面URL: ${pageUrl || ''}`,
    `页面摘要: ${(pageContent || '').slice(0, 1200)}`,
    `用户消息: ${userInput}`,
  ].join('\n');

  const rawText = await callAIJSON(prompt, provider, { temperature: 0 });
  const parsed = extractJSON(rawText);
  if (parsed?.mode !== 'action') return null;
  if (!SUPPORTED_BROWSER_ACTIONS.has(parsed.action)) return null;
  return {
    action: parsed.action,
    params: parsed.params || {},
  };
}

function appendActionMessage(action, result) {
  hideWelcome();

  const msgEl = document.createElement('div');
  msgEl.className = 'message action-result assistant';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (action === 'screenshot' && result?.image) {
    bubble.innerHTML = '<div class="action-label">📷 截图</div>';
    const img = document.createElement('img');
    img.className = 'action-screenshot';
    img.src = result.image;
    img.alt = '页面截图';
    img.addEventListener('click', () => window.open(result.image, '_blank'));
    bubble.appendChild(img);
  } else if (action === 'navigate') {
    bubble.innerHTML = `<div class="action-label">🌐 已导航</div><div class="action-detail">${escapeHtml(result?.url || '')}</div>`;
    // 导航后刷新页面上下文
    setTimeout(updatePageContext, 600);
  } else if (action === 'click') {
    const label = result?.text || result?.tag || '元素';
    bubble.innerHTML = `<div class="action-label">🖱️ 已点击</div><div class="action-detail">${escapeHtml(label)}</div>`;
  } else if (action === 'fill') {
    bubble.innerHTML = `<div class="action-label">✏️ 已填写</div><div class="action-detail">${result?.length || 0} 个字符</div>`;
  } else if (action === 'select') {
    bubble.innerHTML = `<div class="action-label">📋 已选择</div><div class="action-detail">${escapeHtml(result?.label || result?.value || '')}</div>`;
  } else if (action === 'scroll') {
    const dir = (result?.scrollY || 0) > 0 ? '↓' : '↑';
    bubble.innerHTML = `<div class="action-label">${dir} 已滚动</div><div class="action-detail">scrollY: ${result?.scrollY || 0}</div>`;
  } else if (action === 'read') {
    const text = result?.text || '';
    bubble.innerHTML = `<div class="action-label">📄 页面内容</div><p>${escapeHtml(text.slice(0, 500))}${text.length > 500 ? '…' : ''}</p>`;
  } else {
    bubble.innerHTML = `<div class="action-label">✅ 完成</div>`;
  }

  const timeEl = document.createElement('div');
  timeEl.className = 'message-time';
  timeEl.textContent = formatTime(new Date());

  msgEl.appendChild(bubble);
  msgEl.appendChild(timeEl);
  chatArea.appendChild(msgEl);
  scrollToBottom();
}

function clearInput() {
  chatInput.value = '';
  chatInput.style.height = 'auto';
  charCount.textContent = '0';
}

function showRestrictedPageNotice() {
  appendMessage('assistant', `⚠️ ${getRestrictedPageHelpText()}`);
}

function showUnavailablePageNotice() {
  appendMessage('assistant', `⚠️ ${getUnavailablePageHelpText()}`);
}

function isVisibilityQuestion(text) {
  return /(能看见|看得到|看到页面|看到浏览器|读取页面内容|能读取|能分析当前页面|can you see|can you read this page)/i.test(text);
}

function answerVisibilityQuestion(text) {
  if (!isVisibilityQuestion(text)) return null;
  if (isProtectedPageUrl(pageUrl) || isRestrictedPageContext) {
    return `不能直接读取。${getRestrictedPageHelpText()}`;
  }
  if (isPageContentUnavailable || !pageContent.trim()) {
    return `暂时还不行。${getUnavailablePageHelpText()}`;
  }
  return `可以。我已经拿到了当前普通网页的文本内容，可以直接帮你总结、分析、提取信息，或根据页面内容协助填写表单。当前页面标题是“${pageTitle || '未知页面'}”。`;
}

// 检测浏览器命令，匹配到则执行并返回 true
async function tryBrowserCommand(text) {
  const t = text.trim();

  // 截图
  if (/^(截图|截屏|screenshot|take screenshot|帮我截图|给我截图)$/i.test(t)) {
    appendMessage('user', t);
    clearInput();
    try { appendActionMessage('screenshot', await runBrowserAction('screenshot')); }
    catch (e) { appendMessage('error', `❌ 截图失败：${e.message}`); }
    return true;
  }

  // 向下滚动
  if (/^(向下滚动|scroll down|下滑|往下滚|滚动到下面|page down)$/i.test(t)) {
    appendMessage('user', t);
    clearInput();
    try { appendActionMessage('scroll', await runBrowserAction('scroll', { direction: 'down' })); }
    catch (e) { appendMessage('error', `❌ 滚动失败：${e.message}`); }
    return true;
  }

  // 向上滚动
  if (/^(向上滚动|scroll up|上滑|往上滚|回到顶部|page up|top)$/i.test(t)) {
    appendMessage('user', t);
    clearInput();
    try { appendActionMessage('scroll', await runBrowserAction('scroll', { direction: 'up', amount: 99999 })); }
    catch (e) { appendMessage('error', `❌ 滚动失败：${e.message}`); }
    return true;
  }

  // 读取页面
  if (/^(读取页面|read page|获取页面内容|get page content)$/i.test(t)) {
    appendMessage('user', t);
    clearInput();
    if (isProtectedPageUrl(pageUrl) || isRestrictedPageContext) {
      showRestrictedPageNotice();
      return true;
    }
    if (isPageContentUnavailable) {
      showUnavailablePageNotice();
      return true;
    }
    try { appendActionMessage('read', await runBrowserAction('read', {})); }
    catch (e) { appendMessage('error', `❌ 读取失败：${e.message}`); }
    return true;
  }

  // 导航: "导航到 URL" / "打开 URL" / "go to URL"
  const navMatch = t.match(/^(?:导航到|打开|go to|navigate to|访问|open)\s+(.+)$/i);
  if (navMatch) {
    let url = navMatch[1].trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    appendMessage('user', t);
    clearInput();
    try { appendActionMessage('navigate', await runBrowserAction('navigate', { url })); }
    catch (e) { appendMessage('error', `❌ 导航失败：${e.message}`); }
    return true;
  }

  // 点击: "点击 selector" / "click selector"
  const clickMatch = t.match(/^(?:点击|单击|click)\s+(.+)$/i);
  if (clickMatch) {
    const selector = clickMatch[1].trim();
    appendMessage('user', t);
    clearInput();
    try { appendActionMessage('click', await runBrowserAction('click', { selector })); }
    catch (e) { appendMessage('error', `❌ 点击失败：${e.message}`); }
    return true;
  }

  // 填写: "填写 selector 内容" / "fill selector value"
  const fillMatch = t.match(/^(?:填写|输入|fill)\s+(\S+)\s+(.+)$/i);
  if (fillMatch) {
    const selector = fillMatch[1].trim();
    const value    = fillMatch[2].trim();
    appendMessage('user', t);
    clearInput();
    try { appendActionMessage('fill', await runBrowserAction('fill', { selector, value })); }
    catch (e) { appendMessage('error', `❌ 填写失败：${e.message}`); }
    return true;
  }

  return false;
}

// ============================================================
// 发送消息
// ============================================================

async function sendMessage(userInput) {
  const rawText = userInput.trim();
  const hasAttachments = attachedFiles.length > 0;
  if ((!rawText && !hasAttachments) || isStreaming) return;
  const text = rawText || '请阅读这些附件并协助我处理。';

  if (!hasAttachments) {
    const visibilityAnswer = answerVisibilityQuestion(text);
    if (visibilityAnswer) {
      appendMessage('user', text);
      clearInput();
      appendMessage('assistant', visibilityAnswer);
      return;
    }
  }

  // 浏览器命令无需 API Key，优先处理
  if (!hasAttachments && await tryBrowserCommand(text)) return;

  if (!hasAttachments && shouldTryAgentAction(text)) {
    if (isProtectedPageUrl(pageUrl) || isRestrictedPageContext) {
      const readLikeRequest = /(看见|读取|分析|提取|页面内容|这个页面写了什么|能看到)/i.test(text);
      if (readLikeRequest) {
        appendMessage('user', text);
        clearInput();
        showRestrictedPageNotice();
        return;
      }
    }
    if (isPageContentUnavailable) {
      const readLikeRequest = /(看见|读取|分析|提取|页面内容|这个页面写了什么|能看到)/i.test(text);
      if (readLikeRequest) {
        appendMessage('user', text);
        clearInput();
        showUnavailablePageNotice();
        return;
      }
    }
    try {
      const inferred = await inferBrowserAction(text);
      if (inferred) {
        appendMessage('user', text);
        clearInput();
        const result = await runBrowserAction(inferred.action, inferred.params);
        appendActionMessage(inferred.action, result);
        return;
      }
    } catch (err) {
      // 推断失败是正常情况（普通聊天消息不含浏览器指令），静默处理
    }
  }

  // 检查当前 Provider 的 API Key
  if (!apiKeys[activeProvider]) {
    showNoKeyNotice();
    return;
  }

  // 添加用户消息到 UI（appendMessage 内部会隐藏欢迎状态）
  const visibleMessage = hasAttachments
    ? `${text}\n\n📎 附件：\n${attachedFiles.map((file) => `• ${file.path}`).join('\n')}`
    : text;
  appendMessage('user', visibleMessage);

  const attachmentPayload = buildAttachmentPayload(rawText);

  // 添加到对话历史
  conversationHistory.push({ role: 'user', content: attachmentPayload.historyContent });

  // 限制历史长度为20条
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-20);
  }

  // 清空输入框
  chatInput.value = '';
  chatInput.style.height = 'auto';
  charCount.textContent = '0';

  // 禁用输入
  setInputEnabled(false);

  // 显示打字动画
  const typingEl = showTypingIndicator();

  try {
    let userContent = attachmentPayload.requestContent;
    const provider  = PROVIDERS[activeProvider];

    // 优先：用户手动粘贴/上传了图片
    if (pastedImages.length > 0) {
      const contentArr = [];
      for (const dataUrl of pastedImages) {
        if (provider.format === 'anthropic') {
          contentArr.push({
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: dataUrl.split(',')[1] },
          });
        } else {
          contentArr.push({ type: 'image_url', image_url: { url: dataUrl, detail: 'high' } });
        }
      }
      const userMsg = typeof userContent === 'string' ? userContent : text;
      const groundedMsg = `[截图说明：以下图片是用户手动截图/上传，请只根据图片内容回答]\n\n${userMsg}`;
      contentArr.push({ type: 'text', text: groundedMsg });
      userContent = contentArr;
      clearPastedImages();

    // 次选：自动截图注入（关键词触发或页面文本为空）
    } else if (!hasAttachments && shouldAutoScreenshot(text)) {
      try {
        const shot = await runBrowserAction('screenshot', {});
        if (shot?.image) {
          userContent = buildVisionContent(
            shot.image,
            typeof userContent === 'string' ? userContent : text,
            provider.format
          );
        }
      } catch (e) {
        // 截图失败不影响正常聊天
      }
    }

    // 调用 Claude API（流式）
    const requestMessages = [
      ...conversationHistory.slice(0, -1),
      { role: 'user', content: userContent },
    ];
    const aiResponse = await callClaudeStream(requestMessages, typingEl);

    // 添加 AI 回复到历史
    conversationHistory.push({ role: 'assistant', content: aiResponse });

    // 限制历史长度
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    // 保存对话历史
    await chrome.storage.local.set({ conversationHistory });
    clearAttachments();

  } catch (err) {
    // 移除打字动画
    typingEl.remove();
    // 显示错误消息
    appendMessage('error', `❌ 请求失败：${err.message}`);
  }

  // 恢复输入
  setInputEnabled(true);
  chatInput.focus();
}

// ============================================================
// Vision 辅助：自动截图注入
// ============================================================

const VISION_KEYWORDS = /帮我填|自动填|看看这个|分析表格|这个页面|这个表单|注册|填写|能看到|看到页面|截图|表单字段|表格内容|页面内容|这里写的|这个网页/;

function shouldAutoScreenshot(text) {
  // 当消息含视觉关键词，或页面内容为空（SPA fallback）时注入截图
  return VISION_KEYWORDS.test(text) || pageContent.trim().length < 50;
}

function buildVisionContent(dataUrl, text, format) {
  // 在用户消息前加锚定指令，防止 AI 被历史上下文误导
  const groundedText =
    `[截图说明：以下图片是用户当前浏览器页面的截图，请只根据图片内容回答，不要联想其他话题或之前聊过的内容]\n\n${text}`;

  if (format === 'anthropic') {
    // Claude 原生格式
    const base64 = dataUrl.split(',')[1] || dataUrl;
    return [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
      { type: 'text', text: groundedText },
    ];
  }
  // OpenAI 兼容格式（DeepSeek/OpenAI/Gemini/Grok/Kimi）
  return [
    { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
    { type: 'text', text: groundedText },
  ];
}

// ============================================================
// Claude API 调用（流式 SSE）
// ============================================================

async function callClaudeStream(messages, typingEl) {
  const provider = PROVIDERS[activeProvider];
  const key      = getProviderApiKey(activeProvider);
  const extraBody = getProviderExtraBody(activeProvider, activeModel, { includeThinkingDisabled: true });

  // 构建 system prompt
  const contextParts = [
    '你是一个智能网页助手，同时具备浏览器控制能力。',
    '用户可以直接输入以下命令控制浏览器（无需你调用，直接由扩展执行）：',
    '• 截图 — 截取当前页面截图',
    '• 导航到 URL — 在当前标签页打开网址',
    '• 点击 CSS选择器 — 点击页面元素',
    '• 填写 CSS选择器 内容 — 向输入框填写内容',
    '• 向下滚动 / 向上滚动 — 滚动页面',
    '• 读取页面 — 获取页面文本',
    '如果用户询问"怎么截图"或"怎么点击某元素"，向他们介绍上述命令。',
  ];
  if (isProtectedPageUrl(pageUrl) || isRestrictedPageContext) {
    contextParts.push('当前页面是受保护页面（如 chrome:// 或 Chrome Web Store 后台），你无法直接读取 DOM。');
    contextParts.push('此时应明确告诉用户：请使用截图、附加文档、或手动粘贴字段内容，然后再协助整理和填写。');
  } else if (!isPageContentUnavailable && pageContent.trim().length > 0) {
    contextParts.push('当前页面是普通网页，你已经成功拿到了页面文本内容。');
    contextParts.push('如果用户问你能否看见/读取当前页面，答案应是：可以，你已经具备当前页面文本上下文。');
    contextParts.push('此时应直接基于页面内容回答、总结、分析，而不是说自己看不见页面。');
  }
  if (pageTitle) contextParts.push(`\n当前页面标题：${pageTitle}`);
  if (pageUrl)   contextParts.push(`当前页面 URL：${pageUrl}`);
  if (pageContent && pageContent.trim().length > 10) {
    contextParts.push(`\n页面结构化内容：\n${pageContent.slice(0, 8000)}`);
  }
  contextParts.push('\n请用中文回答，除非用户指定其他语言。保持回答清晰简洁。');
  const systemPrompt = contextParts.join('\n');

  // 构造请求
  let fetchOptions;
  if (provider.format === 'anthropic') {
    fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: activeModel,
        max_tokens: 2048,
        system: systemPrompt,
        ...extraBody,
        messages,  // Anthropic: no 'system' role, only user/assistant
        stream: true,
      }),
    };
  } else {
    // OpenAI-compatible (DeepSeek, OpenAI)
    fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: activeModel,
        max_tokens: 2048,
        stream: true,
        ...extraBody,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    };
  }

  const response = await fetch(provider.endpoint, fetchOptions);

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try {
      const errData = await response.json();
      errMsg = errData?.error?.message || errMsg;
    } catch (e) {}
    if (response.status === 401) {
      errMsg = `${provider.name} API Key 无效或未绑定可用项目，请在设置中重新填写`;
    }
    else if (response.status === 429) errMsg = '请求过于频繁，请稍后再试';
    else if (response.status === 500) errMsg = '服务器错误，请稍后重试';
    throw new Error(errMsg);
  }

  // 移除打字动画，创建 AI 消息气泡
  typingEl.remove();
  const { bubble, timeEl } = appendMessageEmpty('assistant');

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer   = '';
  let anthropicEvent = '';

  isStreaming = true;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (provider.format === 'anthropic') {
          // Anthropic SSE: "event: content_block_delta" then "data: {delta.text}"
          if (line.startsWith('event: ')) {
            anthropicEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ') && anthropicEvent === 'content_block_delta') {
            try {
              const parsed = JSON.parse(line.slice(6).trim());
              const text = parsed.delta?.text;
              if (text) {
                fullText += text;
                bubble.innerHTML = renderMarkdown(fullText);
                scrollToBottom();
              }
            } catch (e) {}
            anthropicEvent = '';
          }
        } else {
          // OpenAI-compatible SSE: "data: {choices[0].delta.content}"
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              bubble.innerHTML = renderMarkdown(fullText);
              scrollToBottom();
            }
          } catch (e) {}
        }
      }
    }
  } finally {
    isStreaming = false;
  }

  timeEl.textContent = formatTime(new Date());
  return fullText;
}

// ============================================================
// Markdown 简单渲染（防 XSS）
// ============================================================

function renderMarkdown(text) {
  // 先转义 HTML 特殊字符（防 XSS）
  let html = escapeHtml(text);

  // 代码块（多行）```lang\ncode\n```
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.trimEnd()}</code></pre>`;
  });

  // 行内代码 `code`
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // 标题 ## / ###
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 粗体 **text**
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  // 斜体 *text*（单个星号，不影响列表）
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  // 无序列表（- item 或 * item）
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(\n)?)+/g, (match) => `<ul>${match}</ul>`);

  // 有序列表（1. item）
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // 换行处理：两个换行 → 段落，单个换行 → <br>
  // 先处理段落（pre/ul/h 标签之间不加 p）
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // 已经是 HTML 块级元素
    if (/^<(pre|ul|ol|h[1-6]|li)/.test(trimmed)) return trimmed;
    // 普通段落：单换行转 <br>
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// 消息渲染
// ============================================================

function hideWelcome() {
  const el = document.getElementById('welcomeState');
  if (el) el.style.display = 'none';
}

function appendMessage(role, content, scrollTo = true) {
  hideWelcome();

  const msgEl = document.createElement('div');
  msgEl.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (role === 'assistant') {
    bubble.innerHTML = renderMarkdown(content);
  } else if (role === 'error') {
    bubble.textContent = content;
  } else {
    // 用户消息：纯文本，换行转 <br>
    bubble.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
  }

  const timeEl = document.createElement('div');
  timeEl.className = 'message-time';
  timeEl.textContent = formatTime(new Date());

  msgEl.appendChild(bubble);
  msgEl.appendChild(timeEl);
  chatArea.appendChild(msgEl);

  if (scrollTo) scrollToBottom();
  return msgEl;
}

// 添加空的 AI 消息气泡（用于流式填充）
function appendMessageEmpty(role) {
  const msgEl = document.createElement('div');
  msgEl.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = '';

  const timeEl = document.createElement('div');
  timeEl.className = 'message-time';

  msgEl.appendChild(bubble);
  msgEl.appendChild(timeEl);
  chatArea.appendChild(msgEl);
  scrollToBottom();

  return { msgEl, bubble, timeEl };
}

// 显示打字动画
function showTypingIndicator() {
  const msgEl = document.createElement('div');
  msgEl.className = 'message assistant';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;

  msgEl.appendChild(bubble);
  chatArea.appendChild(msgEl);
  scrollToBottom();
  return msgEl;
}

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function formatTime(date) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// 快捷操作
// ============================================================

const QUICK_ACTION_PROMPTS = {
  summarize: '请用中文总结这个页面的主要内容',
  keypoints: '提取这个页面的5个关键要点，用简洁的列表形式呈现',
  translate: '把这个页面的主要内容翻译成中文',
  analyze: '深入分析这个页面的内容，包括主要观点、数据和结论',
  explain: '用简单易懂的语言解释这个页面的核心概念',
};

function handleQuickAction(action) {
  const prompt = QUICK_ACTION_PROMPTS[action];
  if (!prompt) return;

  // 填入输入框并发送
  chatInput.value = prompt;
  charCount.textContent = prompt.length;
  sendMessage(prompt);
}

// 快捷按钮事件
document.querySelectorAll('.pill-btn[data-action]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    handleQuickAction(action);
  });
});

// ============================================================
// 浏览器操作工具栏
// ============================================================

function prefillCmd(prefix) {
  chatInput.value = prefix;
  charCount.textContent = prefix.length;
  chatInput.focus();
  // 光标移到末尾
  chatInput.setSelectionRange(prefix.length, prefix.length);
}

document.getElementById('btnScreenshot').addEventListener('click', async () => {
  appendMessage('user', '截图');
  try { appendActionMessage('screenshot', await runBrowserAction('screenshot')); }
  catch (e) { appendMessage('error', `❌ 截图失败：${e.message}`); }
});

document.getElementById('btnNavigate').addEventListener('click', () => {
  prefillCmd('导航到 ');
});

document.getElementById('btnClick').addEventListener('click', () => {
  prefillCmd('点击 ');
});

document.getElementById('btnFill').addEventListener('click', () => {
  prefillCmd('填写 ');
});


document.getElementById('btnDebugPage').addEventListener('click', async () => {
  appendMessage('user', '诊断页面读取');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'debug_page_access' });
    appendMessage('assistant',
      `### 页面诊断\n` +
      `- URL: ${result?.url || 'unknown'}\n` +
      `- 受保护页面: ${result?.restricted ? '是' : '否'}\n` +
      `- 注入重试: ${result?.injectionAttempted ? '是' : '否'}\n` +
      `- Ping: ${result?.ping?.ok ? 'OK' : '失败'}\n` +
      `- 标题: ${result?.title || result?.ping?.title || 'unknown'}\n` +
      `- 正文长度: ${result?.debug?.textLength ?? 'unknown'}\n` +
      `- body 长度: ${result?.debug?.bodyLength ?? 'unknown'}\n` +
      `- main 命中: ${result?.debug?.mainFound ? '是' : '否'}\n` +
      `${result?.reason ? `- 原因: ${result.reason}\n` : ''}` +
      `${result?.debug?.error ? `- 调试错误: ${result.debug.error}\n` : ''}`
    );
  } catch (e) {
    appendMessage('error', `❌ 诊断失败：${e.message}`);
  }
});

// ============================================================
// 输入框事件
// ============================================================

// 自动扩展文本框高度（最多5行）
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  const maxHeight = parseInt(getComputedStyle(chatInput).lineHeight) * 5 + 16;
  chatInput.style.height = Math.min(chatInput.scrollHeight, maxHeight) + 'px';
  charCount.textContent = chatInput.value.length;
});

// Enter 发送，Shift+Enter 换行
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(chatInput.value);
  }
});

sendBtn.addEventListener('click', () => {
  sendMessage(chatInput.value);
});

function setInputEnabled(enabled) {
  chatInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
  attachFilesBtn.disabled = !enabled;
  clearAttachmentsBtn.disabled = !enabled;
}

attachFilesBtn.addEventListener('click', () => fileInput.click());
clearAttachmentsBtn.addEventListener('click', () => { clearAttachments(); clearPastedImages(); });

fileInput.addEventListener('change', async () => {
  await loadAttachments(fileInput.files);
  fileInput.value = '';
});

// ============================================================
// 图片粘贴 / 上传 — 发给 AI 进行视觉理解
// ============================================================

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function renderImagePreviews() {
  imagePreviewStrip.innerHTML = '';
  pastedImages.forEach((dataUrl, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'img-thumb-wrap';

    const img = document.createElement('img');
    img.className = 'img-thumb';
    img.src = dataUrl;
    img.title = '点击放大';
    img.addEventListener('click', () => window.open(dataUrl, '_blank'));

    const rm = document.createElement('button');
    rm.className = 'img-thumb-remove';
    rm.textContent = '×';
    rm.title = '移除';
    rm.addEventListener('click', () => {
      pastedImages.splice(idx, 1);
      renderImagePreviews();
    });

    wrap.appendChild(img);
    wrap.appendChild(rm);
    imagePreviewStrip.appendChild(wrap);
  });
}

function clearPastedImages() {
  pastedImages = [];
  renderImagePreviews();
}

async function addImages(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    if (pastedImages.length >= 4) break;  // 最多 4 张
    const dataUrl = await blobToDataURL(file);
    pastedImages.push(dataUrl);
  }
  renderImagePreviews();
}

// 📷 按钮 → 文件选择器
attachImageBtn.addEventListener('click', () => imageFileInput.click());
imageFileInput.addEventListener('change', async () => {
  await addImages(Array.from(imageFileInput.files));
  imageFileInput.value = '';
});

// Ctrl+V / Cmd+V 粘贴截图
chatInput.addEventListener('paste', async (e) => {
  const items = Array.from(e.clipboardData?.items || []);
  const imgItem = items.find(i => i.type.startsWith('image/'));
  if (!imgItem) return;
  e.preventDefault();
  const blob = imgItem.getAsFile();
  if (!blob) return;
  if (pastedImages.length >= 4) {
    appendMessage('error', '❌ 最多同时附加 4 张图片，请先发送或移除已有图片。');
    return;
  }
  const dataUrl = await blobToDataURL(blob);
  pastedImages.push(dataUrl);
  renderImagePreviews();
});

// ============================================================
// API Key 未配置提示
// ============================================================

function showNoKeyNotice() {
  hideWelcome();

  if (chatArea.querySelector('.no-key-notice')) return;

  const p = PROVIDERS[activeProvider];
  const notice = document.createElement('div');
  notice.className = 'no-key-notice';
  notice.innerHTML = `
    <div class="notice-icon">🔑</div>
    <div class="notice-title">${p.icon} ${p.name} 未配置 API Key</div>
    <div class="notice-desc">请在设置中填入 <strong>${p.name}</strong> API Key，或点击 Header 的模型 Badge 切换到其他 Provider。<br>浏览器控制命令（截图、导航等）无需 API Key。</div>
    <button class="notice-settings-btn" id="noticGoSettingsBtn">前往设置</button>
  `;
  chatArea.appendChild(notice);

  document.getElementById('noticGoSettingsBtn').addEventListener('click', () => {
    openSettings();
  });

  scrollToBottom();
}

// ============================================================
// 清空对话
// ============================================================

clearBtn.addEventListener('click', async () => {
  if (!confirm('确定要清空所有对话记录吗？')) return;

  conversationHistory = [];
  await chrome.storage.local.set({ conversationHistory: [] });

  // 清空聊天区域
  chatArea.innerHTML = '';

  // 重新显示欢迎界面
  const welcome = document.createElement('div');
  welcome.className = 'welcome-state';
  welcome.id = 'welcomeState';
  welcome.innerHTML = `
    <div class="welcome-icon">🤖</div>
    <div class="welcome-title">你好，我是 Hermes AI</div>
    <div class="welcome-desc">分析页面、回答问题、总结要点。<br>还可直接控制浏览器：输入 <code style="background:#1a1a3e;padding:1px 4px;border-radius:3px;font-size:10px">截图</code>、<code style="background:#1a1a3e;padding:1px 4px;border-radius:3px;font-size:10px">导航到 URL</code>，或点击工具栏按钮。</div>
  `;
  chatArea.appendChild(welcome);
});

// ============================================================
// 设置面板
// ============================================================

function openSettings() {
  settingsOverlay.classList.add('open');
  // 刷新 Bridge 状态
  checkBridgeStatus();
}

function closeSettings() {
  settingsOverlay.classList.remove('open');
}

settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);

saveSettingsBtn.addEventListener('click', async () => {
  // 收集所有 provider 的 API Key
  for (const pid of PROVIDER_ORDER) {
    const el = document.getElementById(`apiKey_${pid}`);
    if (el) apiKeys[pid] = el.value.trim();
  }

  await chrome.storage.local.set({ apiKeys });

  // 刷新 badge（key 状态可能变化）
  updateModelBadge();

  saveSettingsBtn.textContent = '✅ 已保存';
  setTimeout(() => { saveSettingsBtn.textContent = '保存设置'; }, 1500);

  // 当前 provider 已有 key 时自动关闭
  if (apiKeys[activeProvider]) {
    setTimeout(closeSettings, 800);
  }
});

// ============================================================
// Bridge 状态
// ============================================================

async function checkBridgeStatus() {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'check_bridge' });
    updateBridgeUI(result?.connected || false);
  } catch (e) {
    updateBridgeUI(false);
  }
}

function updateBridgeUI(connected) {
  bridgeDot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
  bridgeStatusText.textContent = connected ? '已连接' : '未连接';
  bridgeConnectBtn.disabled = connected;
  bridgeDisconnectBtn.disabled = !connected;
}

bridgeConnectBtn.addEventListener('click', async () => {
  bridgeConnectBtn.disabled = true;
  bridgeConnectBtn.textContent = '连接中...';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'bridge_connect' });
    updateBridgeUI(result?.connected || false);
  } catch (e) {
    updateBridgeUI(false);
  }
  bridgeConnectBtn.textContent = '连接';
});

bridgeDisconnectBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'bridge_disconnect' });
  updateBridgeUI(false);
});

// ============================================================
// 智能填表 — 资料面板
// ============================================================

const PROFILE_KEYS = ['developer', 'app', 'compliance', 'custom'];

async function loadProfile() {
  const { profile } = await chrome.storage.local.get(['profile']);
  const data = profile || {};
  for (const k of PROFILE_KEYS) {
    const el = document.getElementById(`profile_${k}`);
    if (el) el.value = data[k] || '';
  }
}

async function saveProfile() {
  const profile = {};
  for (const k of PROFILE_KEYS) {
    const el = document.getElementById(`profile_${k}`);
    if (el) profile[k] = el.value.trim();
  }
  await chrome.storage.local.set({ profile });
  return profile;
}

function getProfileText() {
  return PROFILE_KEYS
    .map(k => {
      const el = document.getElementById(`profile_${k}`);
      const val = el?.value?.trim();
      if (!val) return '';
      const labels = { developer: '开发者信息', app: '应用描述', compliance: '合规答案', custom: '自定义信息' };
      return `### ${labels[k]}\n${val}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

function openProfile() {
  profileOverlay.classList.add('open');
  loadProfile();
}
function closeProfile() { profileOverlay.classList.remove('open'); }

profileBtn.addEventListener('click', openProfile);
closeProfileBtn.addEventListener('click', closeProfile);

// 资料面板 Tab 切换
document.querySelectorAll('.ptab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.profile-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`pane-${btn.dataset.ptab}`)?.classList.add('active');
  });
});

saveProfileBtn.addEventListener('click', async () => {
  await saveProfile();
  saveProfileBtn.textContent = '✅ 已保存';
  setTimeout(() => { saveProfileBtn.textContent = '💾 保存资料'; }, 1500);
});

renderProviderTestResults();
testProvidersBtn.addEventListener('click', async () => {
  testProvidersBtn.disabled = true;
  testProvidersBtn.textContent = '检测中...';
  try {
    await runProviderConnectionTests();
  } finally {
    testProvidersBtn.disabled = false;
    testProvidersBtn.textContent = '检查已配置模型';
  }
});

// ============================================================
// 智能填表 — AI 非流式调用（用于获取 JSON 填写方案）
// ============================================================

async function callAIJSON(userPrompt, provider = PROVIDERS[activeProvider], options = {}) {
  const providerId = options.providerId || activeProvider;
  const key = getProviderApiKey(providerId);
  if (!key) throw new Error(`${provider.name} API Key 未配置`);
  const temperature = options.temperature;
  const model = options.model || getProviderModel(providerId);
  const extraBody = getProviderExtraBody(providerId, model, { includeThinkingDisabled: true });

  let response;
  if (provider.format === 'anthropic') {
    response = await fetch(provider.endpoint.replace('/messages', '/messages'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        ...(typeof temperature === 'number' ? { temperature } : {}),
        ...extraBody,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!response.ok) throw new Error(await extractProviderError(response, provider.name));
    const data = await response.json();
    return data.content?.[0]?.text || '';
  } else {
    response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        ...(shouldSendTemperature(providerId, model, temperature) ? { temperature } : {}),
        ...extraBody,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!response.ok) throw new Error(await extractProviderError(response, provider.name));
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

async function extractProviderError(response, providerName) {
  let detail = `HTTP ${response.status}`;
  try {
    const data = await response.json();
    detail = data?.error?.message || data?.message || detail;
  } catch (e) {}
  return `${providerName}: ${detail}`;
}

function isKimiModel(providerId, model) {
  return providerId === 'kimi' || /^kimi-/i.test(model || '');
}

function shouldSendTemperature(providerId, model, temperature) {
  if (typeof temperature !== 'number') return false;
  if (isKimiModel(providerId, model)) return false;
  return true;
}

function getProviderExtraBody(providerId, model, options = {}) {
  if (isKimiModel(providerId, model) && options.includeThinkingDisabled) {
    return { thinking: { type: 'disabled' } };
  }
  return {};
}

function extractJSON(text) {
  // 先尝试直接解析
  try { return JSON.parse(text); } catch {}
  // 再找第一个 {...} 块
  const m = text.match(/\{[\s\S]*"plan"[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error('AI 返回内容无法解析为 JSON');
}

function renderProviderTestResults(results = []) {
  providerTestStatus.innerHTML = '';
  if (results.length === 0) {
    providerTestStatus.innerHTML = '<div class="model-test-item skip"><div class="model-test-detail">尚未执行检测。</div></div>';
    return;
  }

  for (const result of results) {
    const item = document.createElement('div');
    item.className = `model-test-item ${result.status}`;
    item.innerHTML = `
      <div class="model-test-name">${escapeHtml(result.label)}</div>
      <div class="model-test-detail">${escapeHtml(result.detail)}</div>
    `;
    providerTestStatus.appendChild(item);
  }
}

async function runProviderConnectionTests() {
  for (const pid of PROVIDER_ORDER) {
    const el = document.getElementById(`apiKey_${pid}`);
    if (el) apiKeys[pid] = el.value.trim();
  }
  await chrome.storage.local.set({ apiKeys });
  updateModelBadge();

  const configuredProviders = PROVIDER_ORDER.filter((pid) => !!getProviderApiKey(pid));
  if (configuredProviders.length === 0) {
    renderProviderTestResults([
      { status: 'skip', label: '未检测', detail: '请先在设置中填写至少一个 API Key。' },
    ]);
    return;
  }

  const results = configuredProviders.map((pid) => ({
    status: 'running',
    label: `${PROVIDERS[pid].name} / ${getProviderModel(pid)}`,
    detail: '检测中...',
  }));
  renderProviderTestResults(results);

  for (let i = 0; i < configuredProviders.length; i++) {
    const pid = configuredProviders[i];
    const provider = PROVIDERS[pid];
    const model = getProviderModel(pid);
    try {
      const text = await callAIJSON('Reply with OK only.', provider, {
        providerId: pid,
        model,
        temperature: 0,
      });
      results[i] = {
        status: 'ok',
        label: `${provider.name} / ${model}`,
        detail: `可用。响应摘要：${String(text || 'OK').slice(0, 60)}`,
      };
    } catch (err) {
      results[i] = {
        status: 'error',
        label: `${provider.name} / ${model}`,
        detail: err.message || String(err),
      };
    }
    renderProviderTestResults(results);
  }
}

// ============================================================
// 智能填表 — 主流程
// ============================================================

autoFillBtn.addEventListener('click', async () => {
  autoFillBtn.disabled = true;
  fillStatus.className = 'fill-status';

  try {
    // 1. 保存最新资料
    await saveProfile();
    const profileText = getProfileText();
    const attachmentContext = getPrioritizedAttachmentContext();
    if (!profileText.trim() && !attachmentContext.trim()) {
      fillStatus.textContent = '⚠️ 请先填写资料，或先附加 README/说明文档等文本文件';
      fillStatus.className = 'fill-status error';
      return;
    }

    // 2. 扫描页面表单
    fillStatus.textContent = '🔍 扫描页面表单字段...';
    const formData = await runBrowserAction('scan_forms', {});
    const fields   = formData?.fields || [];

    if (fields.length === 0) {
      fillStatus.textContent = '⚠️ 当前页面未发现可填写的表单字段';
      fillStatus.className = 'fill-status error';
      return;
    }
    fillStatus.textContent = `🤖 发现 ${fields.length} 个字段，AI 分析中...`;

    // 3. 构建 Prompt
    const fieldList = fields.map((f, i) =>
      `${i + 1}. 标签:"${f.label}" 类型:${f.type} 选择器:${f.selector}${f.required ? ' [必填]' : ''}` +
      (f.options?.length ? `\n   选项: ${f.options.slice(0, 20).join(' / ')}` : '')
    ).join('\n');

    const sourceBlocks = [];
    if (profileText.trim()) {
      sourceBlocks.push(`## 用户资料\n${profileText}`);
    }
    if (attachmentContext.trim()) {
      sourceBlocks.push(`## 用户附加项目文件夹内容\n优先参考 README；再参考其他文本文件。\n${attachmentContext}`);
    }

    const prompt = `你是一个网页表单自动填写助手。请根据用户资料为每个表单字段生成合适的值。

## 页面信息
URL: ${formData.url}
标题: ${formData.title}

## 表单字段（共 ${fields.length} 个）
${fieldList}

${sourceBlocks.join('\n\n')}

## 要求
- 如果用户附加了项目文件夹，先读 README，再综合其他文件判断产品定位、功能、合规描述和商店文案。
- 只返回 JSON，不要任何解释文字
- 文件上传字段（type:file）请跳过
- checkbox/radio 用 "true" 或 "false"
- select 字段使用选项的 value 值（竖线前的部分）
- 不确定或无对应资料的字段跳过

返回格式：
{"plan":[{"selector":"选择器","value":"值","type":"fill或click或select"}],"skipped":["原因..."]}`;

    // 4. 调用 AI 获取填写方案
    const rawText  = await callAIJSON(prompt);
    const plan     = extractJSON(rawText);
    const items    = plan.plan || [];

    if (items.length === 0) {
      fillStatus.textContent = '⚠️ AI 未能生成填写方案，请检查资料是否完整';
      fillStatus.className = 'fill-status error';
      return;
    }

    // 5. 逐个执行填写
    let done = 0;
    for (const item of items) {
      fillStatus.textContent = `✏️ 填写中... (${done + 1}/${items.length})`;
      try {
        if (item.type === 'click') {
          await runBrowserAction('click', { selector: item.selector });
        } else if (item.type === 'select') {
          await runBrowserAction('select', {
            selector: item.selector,
            value: String(item.value),
          });
        } else {
          await runBrowserAction('fill', {
            selector: item.selector,
            value: String(item.value),
            humanLike: true,
          });
        }
        done++;
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        // 单个字段失败不中断整体流程
        console.log('[Hermes] fill skipped:', item.selector, e.message);
      }
    }

    // 6. 完成提示
    fillStatus.textContent = `✅ 完成！成功填写 ${done}/${items.length} 个字段`;
    fillStatus.className = 'fill-status ok';

    // 同时在聊天里记录一条摘要
    appendMessage('assistant',
      `✅ **智能填表完成**\n成功填写 **${done}/${items.length}** 个字段\n` +
      (plan.skipped?.length ? `跳过：${plan.skipped.slice(0, 3).join('；')}` : '')
    );
    closeProfile();

  } catch (err) {
    fillStatus.textContent = `❌ ${err.message}`;
    fillStatus.className = 'fill-status error';
  } finally {
    autoFillBtn.disabled = false;
  }
});

// ============================================================
// 启动
// ============================================================

init();
