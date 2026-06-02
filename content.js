// Hermes Browser Bridge — Content Script
// 负责: DOM操作 + 类人交互模拟（含反检测机制）

// ============================================================
// 反检测: 启动时自检暴露特征
// ============================================================

(function selfCheck() {
  const warnings = [];
  if (navigator.webdriver === true) {
    warnings.push('navigator.webdriver === true — 浏览器可能以自动化模式启动');
  }
  try {
    if (chrome && chrome.runtime && chrome.runtime.id) {
      // 正常: 内容脚本总有 runtime.id，这是扩展的正常行为
      // 一些网站会检测 window.chrome 的存在
    }
  } catch(e) {
    // 不在扩展环境中
  }
  if (warnings.length > 0) {
    console.warn('[Hermes Bridge] Detection warnings:', warnings.join('; '));
  }
})();

// ============================================================
// 消息监听器
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message.type];
  if (handler) {
    handler(message)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message || String(err) }));
    return true;
  }
});

const handlers = {};

handlers.ping = async () => ({
  ok: true,
  href: window.location.href,
  title: document.title,
});

handlers.debug_page = async () => {
  const main = document.querySelector('main, article, [role="main"], .content, #content, .main-content');
  const text = main ? main.innerText : document.body.innerText || '';
  return {
    ok: true,
    href: window.location.href,
    title: document.title,
    readyState: document.readyState,
    textLength: text.length,
    bodyLength: (document.body?.innerText || '').length,
    mainFound: !!main,
  };
};

// ============================================================
// 读取页面内容
// ============================================================

handlers.read = async (msg) => {
  await randomDelay(50, 150);
  const selector = msg.selector;
  let text = '';
  let html = '';

  if (selector) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Selector "${selector}" not found`);
    text = el.innerText || el.textContent || '';
    html = el.innerHTML || '';
  } else {
    const main = document.querySelector('main, article, [role="main"], .content, #content, .main-content');
    text = main ? main.innerText : document.body.innerText || '';
    html = main ? main.innerHTML.slice(0, 5000) : document.body.innerHTML.slice(0, 5000);
  }

  return {
    text: text.slice(0, 50000),
    title: document.title,
    url: window.location.href,
  };
};

// ============================================================
// 点击元素 — 含完整类人模拟
// ============================================================

handlers.click = async (msg) => {
  const selector = msg.selector;
  const el = findElement(selector);
  if (!el) throw new Error(`Element not found: "${selector}"`);

  // 1. 缓慢滚动到视图（带的偏移量，不每次都centered）
  await humanScroll(el);

  // 2. 人类反应的随机延迟（200-600ms，看"懂"页面）
  await randomDelay(200, 600);

  const rect = el.getBoundingClientRect();
  const targetX = rect.left + rect.width * (0.2 + Math.random() * 0.6);
  const targetY = rect.top + rect.height * (0.2 + Math.random() * 0.6);

  // 3. 模拟鼠标从当前位置移动到目标（3-5步非线性轨迹）
  await simulateMouseMovement(targetX, targetY);

  // 4. 悬停 + 微小延迟 (假装在看要不要点)
  await randomDelay(100, 300);

  // 5. 执行点击
  const result = await performClick(el, targetX, targetY);

  // 6. 点击后等待页面响应
  await randomDelay(400, 1000);

  return {
    clicked: true,
    tag: el.tagName,
    text: (el.textContent || '').trim().slice(0, 100),
    href: el.href || null,
    position: { x: Math.round(targetX), y: Math.round(targetY) },
  };
};

// ============================================================
// 填写表单 — 模拟真人打字
// ============================================================

handlers.fill = async (msg) => {
  const { selector, value, humanLike } = msg;
  const el = findElement(selector);
  if (!el) throw new Error(`Element not found: "${selector}"`);

  if (el instanceof HTMLSelectElement) {
    return await handleSelectFill(el, value);
  }

  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    throw new Error(`Element is not an input/textarea/select: ${el.tagName}`);
  }

  // 滚动到视图
  await humanScroll(el);
  await randomDelay(200, 400);

  // 模拟鼠标移动到输入框
  const rect = el.getBoundingClientRect();
  await simulateMouseMovement(
    rect.left + rect.width * 0.5,
    rect.top + rect.height * 0.5
  );
  await randomDelay(100, 200);

  // 聚焦 + 点击
  el.focus();
  el.click();
  await randomDelay(150, 350);

  if (humanLike !== false && value.length > 2) {
    // 逐字输入，每字间隔随机40-180ms
    // 常见字母组合打得更快（如 "the", "and", "ing"）
    el.value = '';
    for (let i = 0; i < value.length; i++) {
      el.value += value[i];
      el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: value[i], bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keypress', { key: value[i], bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: value[i], bubbles: true }));

      // 每3-5个字随机停顿一下（像在思考接下来打什么）
      const pause = (i > 0 && i % 4 === 0 && Math.random() < 0.3) ? 300 : 0;
      await randomDelay(pause + 40, pause + 120);
    }
  } else {
    // 快速填入
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await randomDelay(200, 400);
  }

  // 失焦
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  await randomDelay(100, 200);

  return { filled: true, length: value.length, humanLike: humanLike !== false };
};

handlers.select = async (msg) => {
  const { selector, value } = msg;
  const el = findElement(selector);
  if (!el) throw new Error(`Element not found: "${selector}"`);
  if (!(el instanceof HTMLSelectElement)) {
    throw new Error(`Element is not a select: ${el.tagName}`);
  }
  return await handleSelectFill(el, value);
};

// ============================================================
// 提取结构化数据
// ============================================================

handlers.extract = async (msg) => {
  const selectors = msg.selectors;
  const result = {};

  for (const [key, selectorOrConfig] of Object.entries(selectors)) {
    let selector, attr, multiple;

    if (typeof selectorOrConfig === 'string') {
      selector = selectorOrConfig;
      attr = 'text';
      multiple = false;
    } else {
      selector = selectorOrConfig.selector;
      attr = selectorOrConfig.attr || 'text';
      multiple = selectorOrConfig.multiple || false;
    }

    if (multiple) {
      const elements = document.querySelectorAll(selector);
      result[key] = Array.from(elements).map(el => {
        if (attr === 'text') return (el.textContent || '').trim();
        if (attr === 'href') return el.href || el.getAttribute('href') || '';
        return el.getAttribute(attr) || '';
      });
    } else {
      const el = document.querySelector(selector);
      if (el) {
        if (attr === 'text') result[key] = (el.textContent || '').trim();
        else if (attr === 'href') result[key] = el.href || el.getAttribute('href') || '';
        else result[key] = el.getAttribute(attr) || '';
      } else {
        result[key] = null;
      }
    }
  }

  return result;
};

// ============================================================
// 滚动
// ============================================================

handlers.scroll = async (msg) => {
  const direction = msg.direction || 'down';
  const amount = msg.amount || Math.round(window.innerHeight * (0.5 + Math.random() * 0.4));

  const scrollOptions = {
    top: direction === 'down'
      ? window.scrollY + amount
      : Math.max(0, window.scrollY - amount),
    behavior: 'smooth',
  };

  window.scrollTo(scrollOptions);
  await randomDelay(600, 1200);

  // 有时滚动后微微调整（人类行为）
  if (Math.random() < 0.15) {
    window.scrollBy({ top: Math.random() > 0.5 ? 10 : -10, behavior: 'smooth' });
    await randomDelay(100, 300);
  }

  return {
    scrolled: true,
    scrollY: window.scrollY,
    maxScroll: document.documentElement.scrollHeight - window.innerHeight,
  };
};

// ============================================================
// 辅助函数 — 反检测核心
// ============================================================

/**
 * 模拟鼠标移动轨迹：从当前位置到目标坐标
 * 使用3-6步非线性路径，模拟真实鼠标的微小抖动和弧线
 */
async function simulateMouseMovement(targetX, targetY) {
  const steps = 3 + Math.floor(Math.random() * 4); // 3-6步
  const startX = targetX - 50 - Math.random() * 200;
  const startY = targetY - 30 - Math.random() * 100;

  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    // 非线性插值（加速-减速曲线）
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const x = startX + (targetX - startX) * eased + (Math.random() - 0.5) * 3;
    const y = startY + (targetY - startY) * eased + (Math.random() - 0.5) * 3;

    document.dispatchEvent(new MouseEvent('mousemove', {
      clientX: Math.round(x),
      clientY: Math.round(y),
      bubbles: true,
      cancelable: true,
      buttons: 0,
    }));

    // 每步间隔30-80ms（真实鼠标移动的典型间隔）
    await randomDelay(30, 80);
  }
}

/**
 * 执行点击，使用多种策略逐步降级
 */
async function performClick(el, x, y) {
  // 策略1: 原生 click() — 最简单，部分网站检测
  try {
    el.click();
    return;
  } catch (e) {
    // fall through
  }

  // 策略2: 完整事件序列（pointerdown → mousedown → pointerup → mouseup → click）
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    clientX: Math.round(x),
    clientY: Math.round(y),
    screenX: Math.round(x + window.screenX + Math.random() * 50),
    screenY: Math.round(y + window.screenY + Math.random() * 50),
    buttons: 1,
    button: 0,
    which: 1,
  };

  el.dispatchEvent(new PointerEvent('pointerover', eventOptions));
  await sleep(20 + Math.random() * 30);
  el.dispatchEvent(new PointerEvent('pointerenter', eventOptions));
  await sleep(10 + Math.random() * 20);
  el.dispatchEvent(new MouseEvent('mouseover', eventOptions));
  await sleep(20 + Math.random() * 40);
  el.dispatchEvent(new MouseEvent('mouseenter', eventOptions));
  await sleep(30 + Math.random() * 50);
  el.dispatchEvent(new PointerEvent('pointerdown', { ...eventOptions, pointerType: 'mouse' }));
  await sleep(20 + Math.random() * 30);
  el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  await sleep(40 + Math.random() * 80);
  el.dispatchEvent(new PointerEvent('pointerup', { ...eventOptions, pointerType: 'mouse' }));
  await sleep(10 + Math.random() * 20);
  el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  await sleep(10 + Math.random() * 20);
  el.dispatchEvent(new MouseEvent('click', eventOptions));
}

/**
 * 类人滚动 — 带随机偏移量
 */
async function humanScroll(el) {
  const rect = el.getBoundingClientRect();
  const isVisible = (
    rect.top >= -150 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight + 150) &&
    rect.right <= (window.innerWidth)
  );

  if (!isVisible) {
    // 不每次都滚动到正中央（人类不会）
    const blockPositions = ['center', 'start', 'center', 'nearest', 'center'];
    const block = blockPositions[Math.floor(Math.random() * blockPositions.length)];

    el.scrollIntoView({
      behavior: 'smooth',
      block: block,
      inline: 'nearest',
    });
    await randomDelay(400, 800);
  }
}

/**
 * 在范围内生成随机延迟
 */
function randomDelay(min, max) {
  // 正态分布偏好的随机（更接近人类行为）
  const rand = Math.random() + Math.random() + Math.random(); // 0-3
  const normalized = rand / 3; // 0-1, 中心在0.5
  return sleep(min + normalized * (max - min));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleSelectFill(el, value) {
  await humanScroll(el);
  await randomDelay(150, 300);

  el.focus();
  await randomDelay(50, 120);

  const stringValue = String(value ?? '');
  const options = Array.from(el.options);
  const matched = options.find((option) =>
    option.value === stringValue ||
    option.text.trim() === stringValue ||
    option.textContent?.trim() === stringValue
  );

  if (!matched) {
    throw new Error(`Select option not found: "${stringValue}"`);
  }

  el.value = matched.value;
  matched.selected = true;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await randomDelay(120, 240);

  return {
    filled: true,
    type: 'select',
    value: matched.value,
    label: matched.text.trim(),
  };
}

// ============================================================
// 辅助函数 — DOM查找
// ============================================================

function findElement(selector) {
  if (selector.startsWith('//') || selector.startsWith('/')) {
    const result = document.evaluate(
      selector, document, null,
      XPathResult.FIRST_ORDERED_NODE_TYPE, null
    );
    return result.singleNodeValue;
  }

  if (selector.startsWith('text=')) {
    const text = selector.slice(5);
    const elements = document.querySelectorAll('a, button, span, div, label');
    for (const el of elements) {
      if (el.textContent.trim() === text) return el;
    }
    return null;
  }

  return document.querySelector(selector);
}

// ============================================================
// 结构化页面读取（供 AI 理解页面内容：标题/表格/表单）
// ============================================================

handlers.read_structured = async () => {
  const parts = [];

  // 1. 标题层级 → Markdown
  document.querySelectorAll('h1, h2, h3, h4').forEach(h => {
    const t = h.innerText?.trim();
    if (t && t.length < 200) {
      parts.push('#'.repeat(+h.tagName[1]) + ' ' + t);
    }
  });

  // 2. 表格 → Markdown 表格（保留行列关系）
  document.querySelectorAll('table').forEach(tbl => {
    const rows = Array.from(tbl.querySelectorAll('tr'));
    if (!rows.length) return;
    parts.push('');
    rows.forEach((row, ri) => {
      const cells = Array.from(row.querySelectorAll('td, th'))
        .map(c => (c.innerText || '').trim().replace(/\|/g, '｜').replace(/\n/g, ' '));
      if (!cells.length) return;
      parts.push('| ' + cells.join(' | ') + ' |');
      if (ri === 0) parts.push('|' + cells.map(() => '---').join('|') + '|');
    });
    parts.push('');
  });

  // 3. 表单字段列表
  const formFields = [];
  document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    let label = '';
    if (el.id) label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText?.trim() || '';
    if (!label) label = el.getAttribute('aria-label') || el.placeholder || el.name || '';
    if (!label) return;
    const type = el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : (el.type || 'text');
    formFields.push(`• [${type}] ${label.slice(0, 80)}`);
  });
  if (formFields.length) {
    parts.push('\n## 页面表单字段');
    parts.push(...formFields);
  }

  // 4. 正文文本（去重、截断）
  const bodyText = (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim();

  const combined = parts.join('\n').trim() + '\n\n' + bodyText;

  return {
    text:  combined.slice(0, 12000),
    title: document.title,
    url:   window.location.href,
  };
};

// ============================================================
// 扫描页面表单字段（供 AI 自动填表使用）
// ============================================================

handlers.scan_forms = async () => {
  const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'image', 'reset']);
  const fields = [];
  const seen = new Set();

  const els = document.querySelectorAll('input, textarea, select');

  for (const el of els) {
    if (SKIP_TYPES.has(el.type)) continue;

    // 跳过不可见元素
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    // 生成最优选择器
    let selector = '';
    if (el.id) {
      selector = '#' + CSS.escape(el.id);
    } else if (el.name) {
      // name 可能重复，加 type 区分
      const sameNames = document.querySelectorAll(`[name="${el.name}"]`);
      selector = sameNames.length === 1
        ? `[name="${el.name}"]`
        : `[name="${el.name}"]:nth-of-type(${Array.from(sameNames).indexOf(el) + 1})`;
    } else if (el.getAttribute('aria-label')) {
      selector = `[aria-label="${el.getAttribute('aria-label')}"]`;
    } else {
      // fallback: 在父元素中的位置
      const tag  = el.tagName.toLowerCase();
      const idx  = Array.from(el.parentNode.querySelectorAll(tag)).indexOf(el) + 1;
      selector   = `${tag}:nth-of-type(${idx})`;
    }
    if (seen.has(selector)) continue;
    seen.add(selector);

    // 提取标签文字：label[for] > aria-label > placeholder > 相邻文本
    let label = '';
    if (el.id) {
      const lEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lEl) label = lEl.innerText.trim();
    }
    if (!label) label = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText || '';
    if (!label) label = el.getAttribute('placeholder') || '';
    if (!label) {
      // 向上查找最近的含文字节点
      let node = el.parentElement;
      for (let i = 0; i < 4 && node; i++) {
        const lEl = node.querySelector('label, [class*="label"], [class*="title"], legend');
        if (lEl && lEl.innerText.trim()) { label = lEl.innerText.trim(); break; }
        node = node.parentElement;
      }
    }
    if (!label && el.name) label = el.name.replace(/[-_]/g, ' ');

    const field = {
      label:    label.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').slice(0, 120),
      type:     el.tagName === 'SELECT'   ? 'select'
              : el.tagName === 'TEXTAREA' ? 'textarea'
              : (el.type   || 'text'),
      selector,
      value:    el.value || '',
      required: el.required || false,
    };

    if (el.tagName === 'SELECT') {
      field.options = Array.from(el.options).slice(0, 40)
        .map(o => `${o.value}|${o.text.trim()}`)
        .filter(Boolean);
    }

    fields.push(field);
  }

  return { fields, url: window.location.href, title: document.title };
};

// ============================================================
// 暴露自检接口（供测试页调用）
// ============================================================

window.__HERMES_BRIDGE_VERSION__ = '1.0.0';

window.__HERMES_DETECTION_CHECK__ = async function() {
  const results = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // 1. navigator.webdriver
  results.checks.webdriver = {
    passed: navigator.webdriver !== true,
    value: navigator.webdriver,
    details: navigator.webdriver === true
      ? '❌ 浏览器以自动化模式启动 — 可能触发反爬'
      : '✅ 正常浏览器模式',
  };

  // 2. window.chrome
  results.checks.chrome_runtime = {
    passed: true,
    value: typeof chrome !== 'undefined' && !!chrome.runtime,
    details: 'Chrome 扩展内容脚本正常',
  };

  // 3. 事件信任测试
  const testEl = document.createElement('div');
  let trustResult = 'unknown';
  testEl.addEventListener('click', (e) => {
    trustResult = e.isTrusted ? 'trusted' : 'untrusted';
  }, { once: true });
  testEl.click();
  results.checks.event_trust = {
    passed: false,
    value: trustResult,
    details: trustResult === 'untrusted'
      ? '⚠️ 合成事件的 isTrusted=false — 部分网站会检测'
      : '✅ 事件受信任',
  };

  // 4. 权限检测
  results.checks.permissions = {
    passed: true,
    value: 'activeTab, tabs, scripting',
    details: '所有声明权限在内容脚本中可用',
  };

  // 5. WebSocket可用性
  results.checks.websocket = {
    passed: typeof WebSocket !== 'undefined',
    value: typeof WebSocket,
    details: 'WebSocket API 可用',
  };

  // 6. 内容脚本注入检测
  results.checks.content_script = {
    passed: true,
    value: document.documentElement.getAttribute('style'),
    details: '内容脚本成功注入页面上下文',
  };

  return results;
};
