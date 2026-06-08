// Hermes Browser Bridge — AI Results Page v2.0
// 使用 Chrome 内置 AI（Gemini Nano）进行页面总结/分析

const STATUS_BOX = document.getElementById('statusBox');
const STATUS_TEXT = document.getElementById('statusText');
const PROGRESS_FILL = document.getElementById('progressFill');
const DOWNLOAD_INFO = document.getElementById('downloadInfo');
const RESULT_CONTENT = document.getElementById('resultContent');
const RESULT_TITLE = document.getElementById('resultTitle');
const RESULT_BODY = document.getElementById('resultBody');
const BTN_COPY = document.getElementById('btnCopy');
const BTN_RETRY = document.getElementById('btnRetry');
const AI_UNAVAILABLE = document.getElementById('aiUnavailable');
const PAGE_TITLE = document.getElementById('pageTitle');
const PAGE_URL = document.getElementById('pageUrl');

let session = null;

// ============================================================
// 初始化 — 从 URL 参数读取任务
// ============================================================

async function init() {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'summarize';
  const taskId = params.get('taskId');

  if (!taskId) {
    showError('No task ID provided');
    return;
  }

  // 从 storage 读取页面内容和任务信息
  const data = await chrome.storage.local.get([`ai_task_${taskId}`]);
  const task = data[`ai_task_${taskId}`];

  if (!task) {
    showError('Task data not found. The page may have been closed.');
    return;
  }

  // 显示页面信息
  PAGE_TITLE.textContent = task.title || 'Unknown page';
  PAGE_URL.textContent = task.url || '';

  // 设置标题
  if (mode === 'summarize') {
    RESULT_TITLE.textContent = '📝 Summary';
    document.title = 'Summary — Hermes AI';
  } else {
    RESULT_TITLE.textContent = '🔬 Analysis';
    document.title = 'Analysis — Hermes AI';
  }

  // 清理 storage（用完即删，隐私保护）
  chrome.storage.local.remove(`ai_task_${taskId}`);

  // 执行 AI 处理
  await processWithAI(mode, task.text, task);
}

// ============================================================
// AI 处理
// ============================================================

async function processWithAI(mode, text, task) {
  const prompt = mode === 'summarize'
    ? `Please provide a clear, concise summary of the following web page content. Focus on the main points and key information. Write in Chinese unless the page is primarily in English.

Page URL: ${task.url || ''}
Page Title: ${task.title || ''}

Content:
${text}`
    : `Please analyze the following web page content. Provide:
1. **Main topic/purpose** of the page
2. **Key information** presented
3. **Target audience** (who is this for?)
4. **Structure overview** (how is the content organized?)
5. **Notable features** (interactive elements, media, calls-to-action)

Write in Chinese unless the page is primarily in English.

Page URL: ${task.url || ''}
Page Title: ${task.title || ''}

Content:
${text}`;

  try {
    // 尝试创建 AI 会话
    session = await createAISession();

    if (!session) {
      // 显示下载进度
      STATUS_TEXT.textContent = 'Downloading AI model...';
      DOWNLOAD_INFO.classList.add('show');

      // 等待模型下载
      session = await waitForModelDownload();

      if (!session) {
        AI_UNAVAILABLE.style.display = 'block';
        STATUS_BOX.style.display = 'none';
        return;
      }
    }

    STATUS_TEXT.textContent = `AI is ${mode === 'summarize' ? 'summarizing' : 'analyzing'} the page...`;

    // 使用流式输出
    const stream = session.promptStreaming(prompt);
    let result = '';

    for await (const chunk of stream) {
      result = chunk;
      RESULT_BODY.textContent = result;
    }

    // 完成
    session.destroy();
    session = null;

    STATUS_BOX.classList.remove('loading');
    STATUS_BOX.classList.add('done');
    STATUS_TEXT.textContent = '✅ Done';
    PROGRESS_FILL.style.width = '100%';
    RESULT_CONTENT.classList.add('show');

  } catch (err) {
    console.error('[Hermes AI] Processing error:', err);

    if (session) {
      try { session.destroy(); } catch(e) {}
      session = null;
    }

    // 如果失败，尝试不带流式
    try {
      STATUS_TEXT.textContent = 'Retrying with simple mode...';
      const newSession = await createAISession();
      if (newSession) {
        const result = await newSession.prompt(prompt);
        newSession.destroy();

        RESULT_BODY.textContent = result;
        STATUS_BOX.classList.remove('loading');
        STATUS_BOX.classList.add('done');
        STATUS_TEXT.textContent = '✅ Done (simple mode)';
        PROGRESS_FILL.style.width = '100%';
        RESULT_CONTENT.classList.add('show');
        return;
      }
    } catch (e2) {
      // fall through
    }

    showError(err.message || 'AI processing failed');
  }
}

// ============================================================
// AI 会话管理
// ============================================================

// 尝试多个 API 路径（不同 Chrome 版本 API 位置不同）
async function createAISession() {
  const api = await findAIAPI();
  if (!api) return null;

  try {
    const capabilities = await api.capabilities();
    
    if (capabilities.available === 'no') {
      return null;
    }

    if (capabilities.available === 'after-download') {
      // 需要下载模型
      return null;
    }

    // 'readily' — 模型已就绪
    return await api.create({
      systemPrompt: 'You are a helpful AI assistant that summarizes and analyzes web page content. Be clear, concise, and accurate.',
      temperature: 0.4,
      topK: 3,
    });

  } catch (err) {
    console.warn('[Hermes AI] Session creation failed:', err);
    return null;
  }
}

async function waitForModelDownload() {
  const api = await findAIAPI();
  if (!api) return null;

  try {
    // 创建时会自动触发模型下载
    const session = await api.create({
      systemPrompt: 'You are a helpful assistant.',
      temperature: 0.4,
      topK: 3,
      signal: AbortSignal.timeout(300000), // 5分钟超时
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          const pct = Math.round((e.loaded / e.total) * 100);
          PROGRESS_FILL.style.width = pct + '%';
          STATUS_TEXT.textContent = `Downloading AI model... ${pct}%`;
        });
      }
    });

    return session;
  } catch (err) {
    console.warn('[Hermes AI] Download failed:', err);
    return null;
  }
}

async function findAIAPI() {
  // 按优先级检查不同位置的 AI API
  const candidates = [
    () => chrome.ai?.languageModel,
    () => chrome.aiOriginTrial?.languageModel,
    () => self.ai?.languageModel,
    () => window.ai?.languageModel,
  ];

  for (const getter of candidates) {
    try {
      const api = getter();
      if (api) return api;
    } catch (e) {
      // try next
    }
  }

  return null;
}

// ============================================================
// UI 辅助
// ============================================================

function showError(msg) {
  STATUS_BOX.classList.remove('loading');
  STATUS_BOX.classList.add('error');
  STATUS_TEXT.textContent = '❌ Error';
  RESULT_BODY.textContent = `Error: ${msg}`;
  RESULT_BODY.style.color = '#ef4444';
  RESULT_CONTENT.classList.add('show');
  BTN_RETRY.style.display = 'inline-block';
}

// ============================================================
// 事件绑定
// ============================================================

BTN_COPY.addEventListener('click', () => {
  navigator.clipboard.writeText(RESULT_BODY.textContent).then(() => {
    BTN_COPY.textContent = '✅ Copied!';
    setTimeout(() => { BTN_COPY.textContent = '📋 Copy'; }, 2000);
  });
});

BTN_RETRY.addEventListener('click', () => {
  location.reload();
});

// ============================================================
// 启动
// ============================================================

init();
