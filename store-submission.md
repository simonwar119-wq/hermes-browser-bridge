# Chrome Web Store — 提交材料

## 基本信息

| 字段 | 值 |
|------|-----|
| **标题** | Hermes Browser Bridge |
| **摘要** | 让 Hermes Agent 通过本地 WebSocket 控制浏览器 — 导航、读取、截图、点击、填写表单 |
| **语言** | 中文（简体） |
| **类别** | 开发者工具 (Developer Tools) |

---

## 说明（Description）— 中英双语

### 中文（建议使用此版本提交）

```
Hermes Browser Bridge 是一个轻量级 Chrome 扩展，作为 Hermes AI Agent 与浏览器之间的桥梁。它让 AI 助手能够安全地控制您的浏览器，实现网页导航、内容读取、截图、点击、表单填写等操作——所有通信仅发生在本地，不经过任何外部服务器。

== 工作原理 ==
Hermes Bridge 在您的电脑上建立一个本地 WebSocket 连接。Hermes Agent（通过本地的桥接服务器）发送指令，扩展在您的当前标签页中执行操作并返回结果。整个过程完全在本地完成，您的数据不会离开您的电脑。

== 主要功能 ==
• 网页导航 — 自动跳转到指定 URL
• 内容读取 — 读取页面正文和结构化数据
• 截图 — 捕获当前可见标签页
• 点击元素 — 通过 CSS 选择器或文字内容精准点击
• 表单填写 — 模拟真人逐字输入，支持防检测
• 数据提取 — 按选择器批量提取结构化信息
• 类人交互 — 随机延迟、鼠标轨迹模拟、非线性滚动，降低被反爬机制标记的风险

== 适用场景 ==
• AI Agent 自动化测试
• 网页数据采集与分析
• 浏览器自动化操作
• 与 Hermes Agent 配合完成复杂工作流

== 隐私与安全 ==
• 所有通信仅连接本地 127.0.0.1，绝不访问外部网络
• 不收集任何用户数据
• 不读取 Cookie 或登录凭据
• 不需要代理/VPN 配置
• 开源透明，可审计

== 使用前提 ==
需要同时运行 Hermes Bridge Server（Python，开源）。
```

### English (备用)

```
Hermes Browser Bridge is a lightweight Chrome extension that acts as a bridge between Hermes AI Agent and your browser. It enables AI assistants to safely control browser operations — navigation, content reading, screenshots, clicking, form filling — all through local-only communication.

== How It Works ==
The extension establishes a local WebSocket connection on your machine. Hermes Agent sends instructions via a local bridge server, the extension executes them in your current tab, and returns results. Your data never leaves your computer.

== Features ==
• Page navigation to any URL
• Read page content and structured data
• Take screenshots of visible tabs
• Click elements by CSS selector or text content
• Fill forms with human-like typing simulation
• Extract structured data by selectors
• Anti-detection: random delays, mouse movement simulation, non-linear scrolling

== Privacy & Security ==
• All communication is local-only (127.0.0.1)
• Zero data collection
• No cookie or credential access
• Open source and auditable

== Requirements ==
Requires Hermes Bridge Server (Python, open source) to be running locally.
```

---

## 分类建议

| 主分类 | 子分类 | 理由 |
|--------|--------|------|
| **Developer Tools** | — | AI Agent 辅助开发工具，网页自动化 |
| 备选：Productivity | — | 如果开发者工具被拒 |

---

## 商店图标（Store Icon）

已有文件：`icons/icon-128.png`（128x128 纯色）
**建议：** 直接用我们生成的图标。如果想更好看，可以找个在线工具把紫色底换成渐变色或加个"B"字母。

---

## 屏幕截图（Screenshots）

需要 1-5 张 1280x800 或 640x400 的截图。我来生成几张演示图：

1. **主界面** — 扩展弹窗的截图（连接状态）
2. **测试页面** — test-detection.html 的运行结果
3. **终端演示** — 桥接服务器 + curl 测试命令
