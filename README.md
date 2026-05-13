# Hermes浏览器插件 (Hermes Browser Extension)

> 将 Hermes Agent 接入浏览器的桥接层 — 让 AI 像人类一样操作网页。

---

## 目录

- [项目概述](#项目概述)
- [连接架构](#连接架构)
- [架构总览](#架构总览)
- [开发路线图](#开发路线图)
  - [Phase 1: 基础骨架](#phase-1-基础骨架-manifest-v3--content-script--popup)
  - [Phase 2: WebSocket 客户端](#phase-2-websocket-客户端连接-hermes-gateway)
  - [Phase 3: 页面交互命令](#phase-3-页面交互命令)
  - [Phase 4: 类人交互模式](#phase-4-类人交互模式)
  - [Phase 5: 打包与发布](#phase-5-chrome-web-store-打包与发布)
- [文件结构](#文件结构)
- [开发环境搭建](#开发环境搭建)
- [测试策略](#测试策略)
- [已知挑战与风险](#已知挑战与风险)

---

## 项目概述

**Hermes浏览器插件** 是一个 Chrome 浏览器扩展，作为 [Hermes Agent](https://hermes-agent.nousresearch.com) 与浏览器之间的桥接层。它让 Hermes Agent 能够：

- **观察**：读取当前页面的 DOM、文本内容、元素属性
- **操作**：点击按钮、填写表单、导航链接、滚动页面
- **理解**：截取页面截图、提取结构化数据、分析页面布局
- **执行**：模拟人类操作流程，完成多步骤网页任务

本质上，这是一个 **"AI 的双手和眼睛"** — 扩展本身不包含 AI 逻辑，而是通过 WebSocket 连接到 Hermes Gateway，将 Agent 的指令翻译为浏览器可以执行的操作，并将结果反馈回去。

---

## 连接架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户主机                               │
│                                                                │
│  ┌────────────────┐    WebSocket    ┌──────────────────┐       │
│  │  Hermes Agent  │ ◄──────────────► │  Hermes Gateway  │       │
│  │  (命令行/TUI)  │                  │  (ws://127.0.0.1  │       │
│  └────────────────┘                  │   :PORT/gateway) │       │
│                                       └────────┬─────────┘       │
│                                                │                 │
│                                       ┌────────▼─────────┐       │
│                                       │     Browser      │       │
│                                       │  Extension       │       │
│                                       │  (WebSocket      │       │
│                                       │   Client)        │       │
│                                       └────────┬─────────┘       │
│                                                │                 │
│                                       ┌────────▼─────────┐       │
│                                       │  Tab / Page      │       │
│                                       │  (DOM API)       │       │
│                                       └──────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

**数据流：**

1. **Agent → 浏览器**：Agent 通过 Hermes Gateway 发送指令（如 `{action: "click", selector: "#submit-btn"}`）
2. **Gateway 中转**：Gateway 将指令转发给已连接的浏览器扩展
3. **扩展执行**：内容脚本接收指令，通过 DOM API 在页面中执行操作
4. **结果返回**：扩展将执行结果（成功/失败/截图/页面状态）沿原路返回给 Agent

**通信协议：**

- **传输层**：WebSocket (ws://127.0.0.1:默认端口/gateway)
- **消息格式**：JSON-RPC (Hermes 标准协议)
- **连接模型**：长连接，Gateway 管理多扩展连接池
- **鉴权**：连接时发送 `{type: "register", client: "browser-extension"}` 注册身份

---

## 架构总览

### 三层架构

| 层级 | 组件 | 职责 |
|------|------|------|
| **Service Worker** | `background.js` | WebSocket 长连接管理、消息路由、生命周期管理 |
| **Content Script** | `content.js` | DOM 操作、事件模拟、页面状态读取 |
| **Popup UI** | `popup/*` | 用户控制界面（连接状态、配置、手动操作） |

### 消息流程

```
Popup ──(chrome.runtime.sendMessage)──► Service Worker
                                            │
                                    WebSocket │
                                            │
                                       Hermes Gateway
                                            │
                                    WebSocket │
                                            │
                                       Service Worker
                                            │
                              (chrome.tabs.sendMessage) │
                                            │
                                       Content Script ──► Page DOM
```

### 关键设计决策

1. **WebSocket 在 Service Worker 中运行** — 而非 Content Script。Service Worker 生命周期更长，不受页面刷新影响
2. **Content Script 注入于页面加载时** — Manifest V3 的 `content_scripts` 声明式注入
3. **Popup 仅作状态显示** — 不参与核心业务逻辑，显示连接状态、错误日志、手动控制按钮
4. **指令队列** — Service Worker 维护一个 FIFO 指令队列，防止多条指令冲突
5. **心跳机制** — 每 30 秒发送 ping，检测连接健康状态

---

## 开发路线图

### Phase 1: 基础骨架 (Manifest V3 + Content Script + Popup)

**目标**：创建一个能在 Chrome 中加载并显示弹出面板的最小可用扩展。

**交付物：**
- [ ] `manifest.json` — Manifest V3 配置（权限、声明、icons）
- [ ] `background.js` — 空的 Service Worker（日志确认加载）
- [ ] `content.js` — 注入页面的空脚本（console.log 确认注入）
- [ ] `popup/popup.html` — 基础 UI（标题、连接状态指示灯）
- [ ] `popup/popup.js` — 状态获取与显示
- [ ] `popup/popup.css` — 基础样式（Hermes 主题色 #8B5CF6）
- [ ] `icons/` — 扩展图标（16/48/128 px）

**关键文件：**

```jsonc
// manifest.json (Manifest V3)
{
  "manifest_version": 3,
  "name": "Hermes Browser Extension",
  "version": "0.1.0",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

**验收标准：**
- `chrome://extensions` 加载后显示图标
- 点击图标弹出面板
- Content Script 在目标页面中注入（查看 DevTools Console）
- Service Worker 可接收 `chrome.runtime.onMessage` 事件

### Phase 2: WebSocket 客户端 (连接 Hermes Gateway)

**目标**：让扩展通过 WebSocket 连接到 Hermes Gateway，建立双向通信。

**交付物：**
- [ ] `background.js` 添加 WebSocket 连接逻辑
- [ ] 连接/断连/重连状态管理
- [ ] 心跳检测 (ping/pong, 30s 间隔)
- [ ] 自动重连机制 (指数退避: 1s → 2s → 4s → 8s → 上限 60s)
- [ ] 消息序列化与路由 (JSON-RPC 消息解析)
- [ ] Popup 显示实时连接状态

**WebSocket 状态机：**

```
DISCONNECTED
     │
     ▼  connect()
 CONNECTING
     │
     ▼  onopen()
 CONNECTED ──► heartbeat() ──► ping/pong 每 30s
     │
     ├── onclose() ──► DISCONNECTED ──► reconnect()
     │                                       │
     └── onerror() ──► DISCONNECTED ──► reconnect()
```

**配置参数 (通过 storage API 可配置)：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `gatewayHost` | `127.0.0.1` | Gateway 主机地址 |
| `gatewayPort` | `8765` | Gateway 端口 |
| `reconnectMaxAttempts` | `10` | 最大重连次数 |
| `heartbeatInterval` | `30000` | 心跳间隔 (ms) |

**验收标准：**
- 启动 Hermes Gateway 后，扩展自动连接
- Popup 显示绿色指示灯（已连接）
- 关闭 Gateway，扩展自动进入重连状态（黄色指示灯）
- 重新启动 Gateway，扩展恢复连接
- 扩展能接收并响应来自 Gateway 的 `ping` 消息

### Phase 3: 页面交互命令

**目标**：让 Agent 能通过扩展读取和操作页面内容。

**支持的命令集：**

| 命令 | 参数 | 描述 |
|------|------|------|
| `navigate` | `url: string` | 导航到指定 URL |
| `click` | `selector: string` | 点击匹配的元素 |
| `type` | `selector, text: string` | 在输入框中输入文本 |
| `read` | `selector?: string` | 读取页面文本（全部或指定区域） |
| `screenshot` | `format?: "png"|"jpeg"` | 截取当前页面截图 |
| `getHtml` | `selector?: string` | 获取页面 HTML 结构 |
| `getAttributes` | `selector: string` | 获取元素属性 |
| `scroll` | `x, y: number` | 滚动到指定位置 |
| `wait` | `ms: number` | 等待指定时间 |
| `getUrl` | (无) | 获取当前页面 URL |
| `getTitle` | (无) | 获取页面标题 |
| `getElement` | `selector: string` | 获取元素的位置、尺寸、可见性 |
| `highlight` | `selector: string` | 高亮元素（用于调试） |

**消息格式 (JSON-RPC)：**

```json
// 请求
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "click",
  "params": {
    "selector": "#login-button",
    "timeout": 5000
  }
}

// 成功响应
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "success": true,
    "data": {
      "tagName": "BUTTON",
      "text": "Login",
      "clickedAt": { "x": 150, "y": 320 }
    }
  }
}

// 错误响应
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "error": {
    "code": -32000,
    "message": "Element not found",
    "data": { "selector": "#login-button" }
  }
}
```

**Content Script 实现要点：**
- **`click`**：使用 `element.click()` + 派发 `mousedown/mouseup` 事件
- **`type`**：设置 `input.value` + 派发 `input/change/keydown/keyup` 事件
- **`read`**：使用 `document.body.innerText` 或 `querySelector` 提取
- **`screenshot`**：通过 `chrome.tabs.captureVisibleTab` API

**验收标准：**
- 每个命令都能从 Gateway 发送并成功执行
- 错误情况（元素不存在、超时、权限不足）有明确的错误返回
- 截图功能正常工作（需 `activeTab` 权限）
- 连续指令按顺序执行（指令队列）

### Phase 4: 类人交互模式

**目标**：让扩展的操作模式更接近真实人类，避免被网站检测为自动化工具。

**实现策略：**

#### 4.1 随机延迟

```javascript
// 在每条指令前插入随机延迟
function humaneDelay(command_type) {
  const delays = {
    click: { min: 100, max: 400 },    // 点击前思考 100-400ms
    type:  { min: 50, max: 200 },     // 逐字符输入延迟
    scroll: { min: 200, max: 600 },   // 滚动前停顿
    navigate: { min: 300, max: 800 }, // 导航前准备
  };
  const range = delays[command_type] || { min: 50, max: 300 };
  return range.min + Math.random() * (range.max - range.min);
}
```

#### 4.2 滚动到视口内再操作

```javascript
function scrollIntoViewIfNeeded(element) {
  const rect = element.getBoundingClientRect();
  const isVisible = (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
  if (!isVisible) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 滚动后额外等待
    return wait(300 + Math.random() * 300);
  }
}
```

#### 4.3 鼠标轨迹模拟

```javascript
// 模拟鼠标从当前位置移动到目标元素
async function simulateMouseMovement(fromX, fromY, toX, toY) {
  const steps = 5 + Math.floor(Math.random() * 5);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // 贝塞尔插值，加入轻微抖动
    const x = fromX + (toX - fromX) * t + (Math.random() - 0.5) * 3;
    const y = fromY + (toY - fromY) * t + (Math.random() - 0.5) * 3;
    dispatchMouseEvent('mousemove', x, y);
    await wait(10 + Math.random() * 15);
  }
}
```

#### 4.4 逐字输入

```javascript
async function typeHumanLike(element, text) {
  element.focus();
  element.value = ''; // 清空
  for (let char of text) {
    element.value += char;
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await wait(30 + Math.random() * 80 + Math.random() * 40);
  }
}
```

#### 4.5 其他人类特征

- **随机鼠标抖动**：点击位置在元素中心 ± 3-8px 偏移
- **页面停留模拟**：导航后等待 1-3 秒再执行后续操作
- **随机滚动**：操作前轻微上下滚动模拟浏览
- **焦点管理**：操作前自动检查/设置元素焦点

**验收标准：**
- 通过 `https://bot.sannysoft.com` 等指纹检测工具的"点击"测试
- 通过 `https://pixelscan.net` 的人类评分测试
- 操作间隔不可预测（非固定延迟）
- 可配置人类化的程度（滑块模式：0 = 最快 / 100 = 最像人类）

### Phase 5: Chrome Web Store 打包与发布

**目标**：将扩展打包并发布到 Chrome Web Store。

**准备清单：**
- [ ] 完善 `manifest.json`（完整的描述、图标、权限说明）
- [ ] 隐私政策文档（收集哪些数据、如何使用）
- [ ] 截图素材（至少 1 张 1280x800 截图）
- [ ] 促销图片（Small Tile: 440x280, Large Tile: 920x680, 等等）
- [ ] 应用描述（中文 + 英文）
- [ ] 开发者账号注册（$5 一次性费用）
- [ ] 代码审查（无 `eval`、无远程代码执行、最小权限原则）
- [ ] `dist/` 目录打包脚本

**打包脚本 (`scripts/package.js`)：**

```javascript
// 流程：
// 1. 读取 manifest.json 中的版本号
// 2. 清理 dist/ 目录
// 3. 复制必要文件（排除 node_modules、tests、.git）
// 4. 使用 Chrome 扩展打包工具生成 .crx
// 5. 输出到 releases/hermes-extension-v{version}.zip
```

**发布流程：**
1. 登录 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. 上传 `.zip` 包
3. 填写应用描述、分类（Productivity / Developer Tools）
4. 设置隐私政策 URL
5. 提交审核（通常 1-3 个工作日，首次可能 5-7 天）
6. 审核通过后自动上线

**验收标准：**
- 扩展成功上架 Chrome Web Store
- 用户可通过搜索 "Hermes" 找到并安装
- 安装后即用（无需开发者模式加载）

---

## 文件结构

```
hermes浏览器插件/
│
├── manifest.json              # Manifest V3 配置文件
├── background.js              # Service Worker (WebSocket 客户端)
├── content.js                 # Content Script (DOM 操作执行器)
│
├── popup/
│   ├── popup.html             # 弹出面板 HTML
│   ├── popup.js               # 弹出面板逻辑
│   └── popup.css              # 弹出面板样式
│
├── lib/
│   ├── websocket-client.js    # WebSocket 连接管理
│   ├── message-router.js      # 消息路由与 JSON-RPC 处理
│   ├── command-executor.js    # 指令执行器
│   ├── humane-commands.js     # 类人操作模式
│   └── config.js              # 配置管理 (chrome.storage)
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── tests/
│   ├── unit/
│   │   ├── websocket-client.test.js
│   │   ├── message-router.test.js
│   │   └── command-executor.test.js
│   ├── integration/
│   │   ├── gateway-connection.test.js
│   │   └── command-execution.test.js
│   └── fixtures/
│       └── test-page.html      # 测试用的 HTML 页面
│
├── scripts/
│   ├── package.js              # 打包脚本
│   └── generate-icons.js       # 图标生成脚本
│
├── docs/
│   ├── protocol.md             # 通信协议文档
│   ├── commands.md             # 命令参考文档
│   └── publishing.md           # 发布流程指南
│
├── SKILL.md                    # Hermes Agent 技能定义
├── README.md                   # 本文件
├── CLAUDE.md                   # Agent 上车手册
└── .gitignore
```

---

## 开发环境搭建

### 前置条件

- **Chrome 浏览器** (v110+, Manifest V3 支持)
- **Node.js** v18+ (用于测试和构建脚本)
- **Hermes Gateway** (本地运行或已安装)
- 推荐: VS Code + Chrome DevTools

### 步骤 1: 克隆项目

```bash
cd /Users/lisun/Desktop/Agent/hermes浏览器插件
git init
git add .
git commit -m "chore: initial project scaffold"
```

### 步骤 2: 安装依赖

```bash
npm init -y
npm install --save-dev \
  jest \              # 测试框架
  @types/chrome \     # Chrome API 类型定义
  eslint \            # 代码检查
  prettier            # 代码格式化
```

### 步骤 3: 在 Chrome 中加载未打包扩展

1. 打开 `chrome://extensions`
2. 开启 **开发者模式** (右上角开关)
3. 点击 **加载已解压的扩展程序**
4. 选择 `/Users/lisun/Desktop/Agent/hermes浏览器插件/` 目录
5. 确认扩展出现在列表中，状态为"已启用"

### 步骤 4: 调试

| 组件 | 调试方式 |
|------|---------|
| Service Worker | `chrome://extensions` → 点击扩展的 **Service Worker** 链接 → DevTools |
| Content Script | 目标页面右键 → 检查 → Console 面板 |
| Popup | 点击扩展图标 → 右键弹出面板 → 检查 |

### 步骤 5: 连接测试

```bash
# 1. 确保 Hermes Gateway 在运行
# 2. 点击扩展图标，确认连接状态指示灯为绿色
# 3. 发送测试指令：
#    - 打开任意页面
#    - 通过 Gateway 发送 { action: "read" }
#    - 确认返回页面内容
```

---

## 测试策略

### 测试金字塔

```
        ┌──────────┐
        │  E2E     │  ← 手动 + Puppeteer 测试真实场景
       ┌┴──────────┴┐
       │ Integration│  ← Gateway ↔ 扩展 ↔ 页面 通信测试
      ┌┴────────────┴┐
      │   Unit Tests  │  ← 命令解析、消息路由、配置管理
     ┌┴───────────────┴┐
     │   Lint + Types   │  ← ESLint + Chrome API 类型检查
     └──────────────────┘
```

### 单元测试 (Jest)

```javascript
// tests/unit/command-executor.test.js
describe('Command Executor', () => {
  test('click command finds element by selector', () => { /* ... */ });
  test('click returns error for non-existent element', () => { /* ... */ });
  test('type command fills input fields', () => { /* ... */ });
  test('read command extracts page content', () => { /* ... */ });
  test('humaneDelay returns values within range', () => { /* ... */ });
});
```

### 集成测试

- **WebSocket 连接测试**：启动本地 Gateway → 连接 → 发送消息 → 验证响应
- **命令执行测试**：打开测试页面 → 发送命令序列 → 验证 DOM 变化
- **重连测试**：断开 Gateway → 验证自动重连 → 重连后继续正常工作

### E2E 测试 (Puppeteer)

```javascript
// 使用 Puppeteer 加载扩展并模拟真实用户场景
const browser = await puppeteer.launch({
  args: [`--disable-extensions-except=${EXT_PATH}`,
         `--load-extension=${EXT_PATH}`]
});
```

### 手动测试清单

- [ ] 扩展加载无错误
- [ ] Popup 显示正确连接状态
- [ ] 点击按钮在目标页面生效
- [ ] 输入文本到表单字段
- [ ] 读取页面内容返回完整文本
- [ ] 截图功能生成有效图片
- [ ] 断开 Gateway 后状态更新
- [ ] 重连后功能恢复正常
- [ ] 类人模式可配置

---

## 已知挑战与风险

### 技术风险

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| Manifest V3 限制 Service Worker 生命周期（最长 5 分钟无事件会终止） | **高** | 高 | 使用 `chrome.alarms` 保持活跃 + 连接恢复机制 |
| Chrome 关闭 WebSocket 连接（非活动标签页限制） | **中** | 高 | 重连机制 + 指数退避 |
| 网站检测自动化（MutationObserver 侦测 DOM 操作模式） | **中** | 中 | Phase 4 的人类化操作（随机延迟、鼠标模拟） |
| Content Script 与页面脚本隔离（Shadow DOM / iframe 兼容性） | **中** | 中 | 递归遍历 shadow roots + iframe 注入 |
| CSP (Content Security Policy) 限制 | **低** | 高 | 不使用 `eval`、不使用内联脚本（Manifest V3 默认阻止） |

### 兼容性风险

- **Shadow DOM**：元素选择器需穿透 shadow roots（`element.shadowRoot` 遍历）
- **iframe**：Content Script 默认不注入 iframe，需额外配置 `all_frames: true`
- **SPA 页面**：DOM 动态变化后，缓存的元素引用可能失效（每次操作前重新查询）
- **PDF 页面**：`<embed>` 或 PDF viewer 不适用 DOM 操作

### 安全风险

- **恶意网站注入** — 确保 Content Script 不在 `chrome://` 或 `about:` 页面运行
- **命令注入** — `selector` 参数必须转义，防止 CSS 选择器注入
- **数据泄露** — `screenshot` 请求需要用户明确授权
- **权限最小化** — 请求必要的最小权限（`activeTab` 而非 `tabs`）

### 发布风险

- Chrome Web Store 审核拒绝（特别是 `host_permissions: ["<all_urls>"]` 需要合理解释）
- 需要提交隐私政策（说明不收集个人数据，仅在本地通信）
- 版本更新审核周期（建议预留 5-7 天）

### 缓解措施总结

1. **尽早测试** — Phase 2 完成后立即测试 WebSocket 稳定性
2. **优雅降级** — 连接断开时缓存指令，恢复后执行
3. **日志驱动** — Service Worker 维护循环日志 buffer（最近 500 条）
4. **用户控制** — Popup 提供"紧急停止"按钮，立即断开所有连接
5. **渐进式发布** — 先内部测试版，再发布到 Chrome Web Store

---

## 贡献指南

1. Fork 本仓库
2. 从 `main` 创建功能分支: `git checkout -b feature/your-feature`
3. 确保通过所有测试: `npm test`
4. 提交 PR，描述变更内容

## 许可证

MIT License — 详见 LICENSE 文件

---

*版本: 0.1.0 (开发中)*
*最后更新: 2026-05-13*
