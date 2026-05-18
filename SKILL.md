---
name: hermes-browser-extension
description: "Build, develop, and debug the Hermes Browser Extension — a Chrome extension (Manifest V3) that bridges Hermes Agent to the browser via WebSocket. Use this when working on the extension's code, testing its features, planning development phases, preparing Chrome Web Store submission, or debugging WebSocket/DOM interaction issues."
---

# SKILL.md — Hermes Browser Extension

> 这是 Hermes 浏览器插件项目的宪法文档。任何 Agent 在修改本项目文件之前必须阅读此文档。

---

## 0. Pre-flight Checklist

```
□ 读过本 SKILL.md 吗？
□ 读过 README.md 吗？（了解项目全貌）
□ 确认当前在哪个 Phase (1-5) 吗？
□ 任务涉及修改 manifest.json？→ 注意 Manifest V3 约束
□ 任务涉及 WebSocket 逻辑？→ 测试重连机制
□ 任务涉及 Content Script？→ 测试 Shadow DOM / iframe 兼容性
□ 修改前是否备份或确保 git 已 commit？
```

---

## 1. 项目核心原则

1. **扩展是桥接层，不包含 AI 逻辑** — 所有智能在 Hermes Agent 端，扩展只做翻译和执行
2. **WebSocket 是生命线** — 连接管理（重连、心跳、状态机）是最高优先级
3. **最小权限原则** — 只请求 `activeTab` 和 `storage`，不为便利扩展权限
4. **人类化优先** — Phase 4 不是可选项，是生产环境的必备条件
5. **Manifest V3 是硬约束** — 所有代码必须遵循 Manifest V3 的 Service Worker 生命周期限制
6. **用户可见状态** — Popup 必须始终显示连接状态，不允许"静默失败"

---

## 2. 架构决策锁定（直接执行，不再讨论）

| 决策 | 选择 | 原因 |
|------|------|------|
| 消息协议 | JSON-RPC 2.0 | Hermes 标准协议，扩展统一使用 |
| WebSocket 位置 | Service Worker | 生命周期长于 Content Script，不受页面刷新影响 |
| 内容脚本注入 | `manifest.json` 声明式 | 比编程式注入更可靠 |
| 选择器策略 | CSS selector + 备用 XPath | CSS 优先，复杂场景 XPath |
| 截图方式 | `chrome.tabs.captureVisibleTab` | Manifest V3 唯一支持的截图 API |
| 状态存储 | `chrome.storage.local` | 比 sync 更快，配置不跨设备 |
| 测试框架 | Jest + Puppeteer | Jest 单元测试，Puppeteer E2E |
| 构建工具 | 无 (vanilla JS) | 扩展是纯前端项目，无需打包工具 |

---

## 3. 文件命名与组织规范

```
hermes浏览器插件/
├── *.js          # 根目录：核心文件 (manifest.json, background.js, content.js)
├── popup/        # 弹出面板
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── lib/          # 模块化逻辑（每个模块职责单一）
│   ├── websocket-client.js   # WebSocket 连接管理
│   ├── message-router.js     # 消息路由
│   ├── command-executor.js   # 指令执行
│   ├── humane-commands.js    # 类人操作
│   └── config.js             # 配置管理
├── icons/        # 扩展图标 (16/48/128 px)
├── tests/        # 测试
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── scripts/      # 开发工具脚本
├── docs/         # 文档
├── SKILL.md      # 本文件
├── README.md     # 项目总览 + 开发计划
├── CLAUDE.md     # Agent 上车手册（可选）
└── .gitignore
```

### 命名规则

- JS 文件：`kebab-case.js`
- 测试文件：`{module-name}.test.js`
- HTML/CSS：`{feature}.html` / `{feature}.css`
- 目录：小写字母，无空格
- 禁止中文文件名（除 `manifest.json` 中的 `name` 字段）

---

## 4. 开发流程

### 标准工作循环

```
1. 确认当前 Phase 和任务范围
2. 阅读相关模块的现有代码
3. 修改代码 (遵守第 5 节编码规范)
4. 运行测试 (npm test)
5. 在 Chrome 中加载未打包扩展进行手动验证
6. 更新 README.md 中的进度标记
7. git commit (遵守第 6 节规范)
```

### 各 Phase 验证方式

| Phase | 验证方式 |
|-------|---------|
| Phase 1 | 加载扩展 → 弹出 Popup → 查看 Console 日志 |
| Phase 2 | 启动 Gateway → 观察 Popup 连接状态 → 发送 ping/pong |
| Phase 3 | 发送命令 → 观察页面变化 → 检查返回结果 |
| Phase 4 | 运行 bot 检测网站 → 对比开关人类化模式的前后差异 |
| Phase 5 | 执行打包脚本 → 上传到 CWS Developer Dashboard → 等待审核 |

---

## 5. 编码规范

### 5.1 JavaScript

```javascript
// ✅ 正确：使用 const/let，避免 var
const ws = new WebSocket(url);
let reconnectAttempts = 0;

// ✅ 正确：使用 async/await
async function sendAndWait(cmd) {
  const result = await executeCommand(cmd);
  return result;
}

// ✅ 正确：错误处理
try {
  await execute(cmd);
} catch (err) {
  handleError(err);
}

// ❌ 禁止：eval、new Function、远程脚本加载
// ❌ 禁止：在 Content Script 中使用 window.top 跨域访问
// ❌ 禁止：硬编码 API key 或 token
```

### 5.2 WebSocket 处理

```javascript
// ✅ 正确：完整的状态管理
const WS_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};

// ✅ 正确：指数退避重连
function getReconnectDelay(attempt) {
  return Math.min(1000 * Math.pow(2, attempt), 60000);
}

// ✅ 正确：心跳机制
function startHeartbeat() {
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);
}
```

### 5.3 Content Script DOM 操作

```javascript
// ✅ 正确：查找元素前验证存在性
const el = document.querySelector(selector);
if (!el) throw new Error(`Element not found: ${selector}`);

// ✅ 正确：操作前滚动到视口
el.scrollIntoView({ behavior: 'smooth', block: 'center' });
await sleep(200);

// ✅ 正确：穿透 Shadow DOM
function findInShadowRoot(selector, root = document) {
  // 优先查询当前 root
  let el = root.querySelector(selector);
  if (el) return el;
  // 遍历所有 shadow roots
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const found = findInShadowRoot(selector, el.shadowRoot);
      if (found) return found;
    }
  }
  return null;
}
```

### 5.4 消息处理

```javascript
// ✅ 正确：所有消息带唯一 ID 以匹配请求和响应
const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
pendingRequests.set(requestId, { resolve, reject, timeout });

// ✅ 正确：统一 JSON-RPC 格式
function createRequest(method, params = {}) {
  return {
    jsonrpc: '2.0',
    id: generateId(),
    method,
    params,
  };
}
```

---

## 6. Git Commit 规范

### 格式

```
{type}({scope}): {简短描述}
```

### Type 枚举

| Type | 用途 |
|------|------|
| `feat` | 新功能（新增命令、新模块） |
| `fix` | 修复 bug |
| `docs` | 文档（README、SKILL、注释） |
| `refactor` | 重构（不改变功能） |
| `test` | 测试 |
| `chore` | 构建、配置、依赖 |

### Scope 枚举

`ws`（WebSocket）、`content`（Content Script）、`popup`、`human`（类人模式）、`config`、`docs`、`build`

### 示例

```
feat(ws): implement automatic reconnection with exponential backoff
fix(content): handle Shadow DOM elements in click command
docs(root): write comprehensive README with development plan
test(ws): add unit tests for message routing
```

### 禁止

- ❌ `update stuff`、`fix things`、`WIP`
- ❌ 一个 commit 混合多个不相关的变更
- ❌ 直接 commit 到 main（除非 solo 开发且改动量极小）

---

## 7. 测试要求

### 最低覆盖标准

- **WebSocket 模块**：90%+ 覆盖率（连接、重连、心跳、消息路由）
- **Command Executor**：85%+（每个命令至少一个成功和一个失败用例）
- **Humane Commands**：80%+（随机延迟范围验证、鼠标轨迹模拟）
- **Popup UI**：手工测试（不强制自动化）

### 测试命名

```javascript
describe('WebSocket Client', () => {
  describe('connect()', () => {
    test('connects to specified host and port', () => { /* ... */ });
    test('emits "connected" event on successful connect', () => { /* ... */ });
    test('throws error on connection timeout', () => { /* ... */ });
  });

  describe('reconnect()', () => {
    test('retries with exponential backoff', () => { /* ... */ });
    test('stops after max attempts', () => { /* ... */ });
    test('emits "reconnecting" state before retry', () => { /* ... */ });
  });
});
```

---

## 8. 已知的兼容性问题

| 问题 | 影响范围 | 处理方法 |
|------|---------|---------|
| Service Worker 在 30 秒无事件后可能被终止 | WebSocket 连接 | 使用 `chrome.alarms` 保持活跃 |
| Content Script 不在 iframe 中默认注入 | iframe 内操作 | `all_frames: true` 配置 |
| Shadow DOM v1 元素不可被 CSS selector 穿透 | 自定义元素 | 使用 `findInShadowRoot()` 函数 |
| `chrome.tabs.captureVisibleTab` 需要用户手势 | 截图命令 | 首次使用前弹出权限请求 |
| CSP 阻止 WebSocket 连接到非安全端口 | 本地开发 | Chrome 允许 `ws://127.0.0.1` |

---

## 9. 安全检查清单

每次提交前确认：

- [ ] 没有使用 `eval()` 或 `Function()` 构造函数
- [ ] 没有内联脚本（Manifest V3 禁止）
- [ ] 所有用户输入（selector 等）经过转义或使用 `textContent` 而非 `innerHTML`
- [ ] WebSocket URL 硬编码为 `ws://127.0.0.1:{port}`，不允许从外部注入
- [ ] `manifest.json` 中的权限不包含不必要的 API
- [ ] Content Script 不在 `chrome://`、`about:`、`chrome-extension://` 页面运行
- [ ] 截图功能有用户手势触发限制
- [ ] 没有将页面数据发送到除本地 Gateway 外的任何服务器

---

## 10. 版本发布流程

```
1. 更新 manifest.json 中的 version 字段（遵循 semver）
2. 更新 README.md 中的版本号
3. 运行 npm test 确保全部通过
4. 执行 npm run package 生成 dist/releases/hermes-extension-v{version}.zip
5. 上传到 Chrome Web Store Developer Dashboard
6. 填写更新说明
7. 提交审核
8. 审核通过后确认线上版本正确
```

---

## 11. 常见命令速查

```bash
# 开发
chrome://extensions          # 扩展管理页面（加载已解压的扩展）
chrome://inspect/#workers    # Service Worker 调试

# 测试
npm test                     # 运行所有测试
npm run test:watch           # 监听模式
npm run test:coverage        # 覆盖率报告

# 打包
npm run package              # 生成发布 zip 包

# Git
git add . && git commit -m "type(scope): message"
```

---

*SKILL.md 版本: 1.0*
*创建: 2026-05-13*
*最后更新: 2026-05-13*
