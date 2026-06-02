# Chrome Web Store — 提交文档 (v3.1)

## 版本说明

- **版本号**: 3.1.0
- **核心功能**: AI 聊天 + 浏览器直接控制（无需 Bridge Server）
- **AI 服务**: DeepSeek API（用户自行填入 API Key）

---

## 单一用途说明

> 粘贴到"隐私权规范"标签页的"单一用途"输入框。

```
Hermes AI Assistant 是一款 AI 聊天和浏览器控制扩展，使用 DeepSeek API 提供智能对话。

主要功能：
1. AI 聊天（需 DeepSeek API Key）：在侧边栏与 AI 对话，分析当前页面内容、总结要点、翻译页面。
2. 浏览器控制（无需 API Key）：通过聊天命令或工具栏按钮直接控制浏览器——截图、导航到指定网址、点击页面元素、填写表单、滚动页面。
3. Bridge 模式（可选，需本地 Hermes Agent）：通过 WebSocket 连接本地服务器，供自动化脚本控制浏览器。

所有 AI 请求通过 HTTPS 发送至 api.deepseek.com。浏览器控制操作完全在本地执行，不涉及任何网络请求。
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
storage 权限用于在用户本地保存：DeepSeek API Key、选定的 AI 模型、对话历史（最多20条）、Bridge 服务器地址配置。所有数据仅存储在用户本地浏览器中，不上传至任何服务器。
```

### host_permissions (<all_urls>)

```
<all_urls> 权限用于内容脚本在任意页面执行操作：读取页面文本、点击元素、填写表单、滚动页面。这些操作仅在用户通过聊天命令或工具栏按钮主动触发时执行。
```

### host_permissions (https://api.deepseek.com/*)

```
此权限用于从侧边栏向 DeepSeek API 发送 AI 聊天请求（需用户提供 API Key）。仅在用户发送聊天消息时触发，不在后台自动发送任何数据。
```

---

## 隐私政策 URL

```
https://raw.githubusercontent.com/simonwar119-wq/hermes-browser-bridge/main/PRIVACY_POLICY.md
```

---

## 简短描述（132 字符以内）

```
AI chat & browser controller. Chat with DeepSeek AI about any page. Navigate, screenshot, click, and fill forms directly from the panel.
```

## 详细描述

```
Hermes AI Assistant — AI Chat & Browser Controller

Open the side panel to chat with DeepSeek AI about any webpage, and control your browser directly without needing any external server.

🤖 AI Chat (requires DeepSeek API Key)
• Chat about the current page — summarize, analyze, translate, explain
• Streaming responses with Markdown rendering
• Conversation history preserved across sessions
• Quick-action buttons: Summary, Key Points, Translate, Analyze, Explain

🖥️ Browser Control (no API Key needed)
Type commands directly in the chat or use toolbar buttons:
• 📷 Screenshot — capture the current page and view inline
• 🌐 Navigate — go to any URL in the current tab
• 🖱️ Click — click any page element by CSS selector or text
• ✏️ Fill — type into form fields with human-like simulation
• ↕️ Scroll — scroll the page up or down
• 📄 Read — extract the page's text content

🔌 Bridge Mode (optional, advanced)
Connect to a local Hermes Agent server via WebSocket for external automation scripts.

🔒 Privacy
• AI requests go only to api.deepseek.com (HTTPS, requires your API Key)
• Browser control runs entirely locally — no network requests
• No analytics, no tracking, no data collection
• API Key stored locally in your browser only

Setup: Click the extension icon → Open AI side panel → Enter your DeepSeek API Key in Settings. Browser control works immediately without any setup.
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
