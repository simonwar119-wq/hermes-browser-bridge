# Chrome Web Store — 提交文档 (v3.1.1)

## 版本说明

- **版本号**: 3.1.1
- **核心功能**: AI 聊天 + 浏览器直接控制 + 可选本地 Bridge
- **AI 服务**: 用户自行选择并填入 API Key（DeepSeek / OpenAI / Anthropic / Gemini / Grok / Kimi）

---

## 单一用途说明

> 粘贴到"隐私权规范"标签页的"单一用途"输入框。

```
Hermes AI Assistant 是一款浏览器侧边栏扩展，用于帮助用户理解当前网页并执行用户主动发起的浏览器操作。

主要功能：
1. AI 聊天：用户可在侧边栏询问当前页面内容、总结要点、翻译页面、分析信息，并使用自己填写的 API Key 直接连接所选 AI 提供商。
2. 浏览器控制：用户可主动触发截图、导航、点击、滚动、读取页面文本、填写表单等操作。
3. 智能填表：用户可保存本地资料，并在网页表单页主动触发自动填写。
4. Bridge 模式（可选）：连接用户自己机器上的本地 Hermes Agent 服务。

AI 请求只会在用户主动发送时，直接从浏览器发往用户选定的 AI 提供商。扩展不运行开发者自有代理服务器。
```

---

## 权限理由

### sidePanel

```
sidePanel 权限用于在浏览器右侧显示 Hermes AI 聊天面板。用户点击扩展图标或工具栏按钮打开侧边栏，在其中进行 AI 对话、查看页面信息、执行浏览器控制操作。
```

### contextMenus

```
contextMenus 权限用于在右键菜单中添加"用 Hermes AI 总结本页"和"用 Hermes AI 分析本页"快捷操作。用户通过右键菜单主动触发，点击后自动打开侧边栏并执行相应分析。
```

### activeTab

```
activeTab 权限用于：(1) 在用户点击总结/分析按钮时读取当前标签页文字内容供 AI 分析；(2) 执行浏览器控制命令（点击、填表、截图、滚动）时操作当前页面。所有操作均需用户主动触发。
```

### tabs

```
tabs 权限用于：(1) 在侧边栏显示当前页面的标题和 URL；(2) Bridge 模式下 Hermes Agent 需要查询和切换标签页；(3) 导航命令需要在当前标签页打开指定网址并等待加载完成。
```

### storage

```
storage 权限用于在用户本地保存：用户自行填写的 API Key、选定的 AI 模型、对话历史（最多20条）、表单填写资料、Bridge 服务器地址配置。所有数据仅存储在用户本地浏览器中，不上传到开发者自有服务器。
```

### scripting

```
scripting 权限用于在普通网页中按需注入扩展自己的内容脚本，以便在用户主动触发操作时读取页面文本、识别表单、点击元素、填写表单和滚动页面。该注入仅作用于用户当前网页，不会在所有网站后台批量运行。
```

### host_permissions (<all_urls>)

```
<all_urls> 权限用于内容脚本在用户当前访问的网页上执行用户主动发起的操作，包括读取页面文本、截图辅助、点击元素、填写表单、滚动页面，以及识别表单结构。这些操作不会在后台自动运行。
```

### host_permissions (AI provider domains)

```
这些 host 权限仅用于在用户发送聊天请求时，直接连接到用户自己选择的 AI 提供商接口，例如 DeepSeek、OpenAI、Anthropic、Gemini、xAI Grok、Moonshot / Kimi。扩展不通过开发者自有中转服务器转发任何请求。
```

---

## 隐私政策 URL

```
请填写一个可公开访问、可在浏览器中直接打开的 HTML 隐私政策页面，不要继续使用 raw.githubusercontent.com 的 Markdown 链接。
```

建议：

```
https://<your-public-domain>/privacy-policy.html
```

如果你直接用 GitHub Pages 发布本仓库的 `/docs` 目录，链接通常会是：

```
https://<your-github-username>.github.io/hermes-browser-bridge/privacy-policy.html
```

---

## 简短描述（132 字符以内）

```
AI side panel: chat any page, auto-fill forms, 6 models (DeepSeek/GPT-5/Claude/Gemini/Grok/Kimi). Paste screenshots for vision AI.
```

## 详细描述

```
Hermes AI Assistant — AI Chat & Browser Controller

Open the Chrome side panel to chat with your chosen AI model about any webpage — and control your browser directly from the panel.

🔀 6 AI Providers — One Click to Switch
Switch between DeepSeek V4, GPT-5.5/5.4, Claude Opus 4.8, Gemini 3.x, Grok 4, and Kimi K2 from the header badge. Each provider uses your own API key — no subscription, no proxy, no backend.

🤖 AI Chat About the Current Page
The extension reads structured page content (headings, tables → Markdown, form fields) and includes it in the AI's context. Ask questions about any page without copy-pasting.
• Streaming responses with Markdown rendering
• Conversation history preserved across sessions
• Quick-action buttons: Summary, Key Points, Translate, Analyze, Explain

📋 Smart Form Auto-Fill (AI-Powered)
Store your profile once — developer info, app descriptions, compliance answers, custom fields. On any web form, click one button to scan all visible fields and have the AI auto-fill them using your stored data. Works on any website.

📷 Screenshot & Vision
• Click 📷 to capture the current tab — shown inline in chat
• Paste any system screenshot (⌘V / Ctrl+V) or upload an image — sent to the AI as a vision message
• Ideal for pages extensions can't read (Chrome Web Store, PDFs)
• Supports up to 4 images per message

🖥️ Browser Control
Type commands or use toolbar buttons:
• 🌐 Navigate — go to any URL in the current tab
• 🖱️ Click — click any page element by CSS selector
• ✏️ Fill — type into form fields with human-like simulation

🔌 Bridge Mode (optional, advanced)
Connect to a local Hermes Agent via WebSocket for external browser automation scripts.

🔒 Privacy First
• API keys stored locally in Chrome — never sent anywhere except your chosen AI provider
• No analytics, no tracking, no data collection
• Page content included in AI requests only when you initiate a query
• Images not stored in conversation history

Setup: Click the extension icon → Open AI Chat → Enter your API Key in Settings → start chatting.
```

---

## 截图说明（建议更新）

1. **screenshot-1-chat.png** — 侧边栏 AI 聊天界面，显示对话消息和快捷按钮
2. **screenshot-2-browser-control.png** — 使用截图命令后在聊天中显示页面截图
3. **screenshot-3-navigate.png** — 输入"导航到 google.com"后成功导航的结果
4. **screenshot-4-settings.png** — 设置面板，显示 DeepSeek API Key 输入框

---

## 审核注意事项

- 扩展使用 DeepSeek API（`api.deepseek.com`），需用户自行申请并填入 API Key
- AI 功能需要 API Key，浏览器控制功能不需要 API Key
- Bridge 模式完全可选，不影响主功能使用
- 内容脚本的 DOM 操作仅在用户主动触发命令时执行
