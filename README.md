# Hermes AI Assistant

> Chrome side-panel extension. Multi-model AI chat with built-in browser control: navigate, screenshot, click, fill forms, and smart auto-fill using stored profile data.

---

## What It Does (Product Overview)

Hermes AI Assistant opens as a side panel on the right side of any Chrome window. It combines two capabilities:

1. **AI Chat** — Chat with top AI models about the current page. The extension reads the page's structured content (headings, tables, forms) and sends it to the AI, which can then summarize, analyze, translate, or answer questions based on real page data.

2. **Browser Control** — The AI and the user can directly control the browser from the panel: navigate to URLs, take screenshots, click elements by selector, fill in form fields, and auto-fill entire forms using stored profile data.

### Who It's For

- **Developers & product managers** who fill out app store submissions, compliance forms, or internal dashboards repeatedly
- **Power users** who want AI assistance while browsing — page summarization, table analysis, Q&A — without switching windows
- **Hermes Agent users** who want to connect their local automation agent to the browser via WebSocket

---

## Key Features

### 1. Multi-Provider AI Chat

Supports 6 AI providers with a single click from the header dropdown:

| Provider | Models | API Format |
|----------|--------|------------|
| 🟣 DeepSeek | deepseek-v4-pro, deepseek-v4-flash, deepseek-chat, deepseek-reasoner | OpenAI-compatible |
| 🟢 OpenAI | gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.4-nano | OpenAI |
| 🔵 Claude (Anthropic) | claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5-20251001 | Anthropic native |
| 🔷 Gemini (Google) | gemini-3.1-pro-preview, gemini-3.5-flash, gemini-2.5-pro, gemini-2.5-flash | OpenAI-compatible |
| ⚡ Grok (xAI) | grok-4, grok-4.3, grok-3, grok-3-mini | OpenAI-compatible |
| 🌙 Kimi (Moonshot) | kimi-k2.6, kimi-k2.5, moonshot-v1-128k, moonshot-v1-32k, moonshot-v1-8k | OpenAI-compatible |

- **One-click model switching**: Click the model badge in the header → dropdown shows all providers and models
- **Per-provider API Keys**: Each provider has its own API key input in Settings
- **Unset key shown in orange** as a visual reminder
- **Streaming responses** with Markdown rendering (code blocks, tables, headings, lists)

### 2. Structured Page Reading

The extension reads the current page and gives the AI structured content instead of raw text:

- `<h1>–<h4>` headings preserved as Markdown hierarchy
- `<table>` elements converted to Markdown tables (row/column structure intact)
- Form fields listed with labels and types
- Up to 8 000 characters sent to the AI system prompt

This means the AI can accurately answer questions about tables (Wikipedia data, product specs, pricing comparisons) and describe form structures without losing relationships between cells.

### 3. Browser Control Toolbar

Four toolbar buttons, always visible above the chat:

| Button | Action |
|--------|--------|
| 📷 | Take a screenshot of the current tab and show inline in chat |
| 🌐 | Pre-fill "navigate to " command in input box |
| 🖱️ | Pre-fill "click " command for CSS-selector clicking |
| ✏️ | Pre-fill "fill " command for form field filling |

Chat commands also work directly:

```
截图                         → screenshot current page
导航到 https://example.com   → navigate active tab
点击 #submit-button          → click element by CSS selector
填写 #email user@example.com → fill input field
向下滚动 / 向上滚动           → scroll the page
```

### 4. Smart Form Auto-Fill (AI-Powered)

The 📋 profile panel stores reusable information in four categories:

| Tab | Contents |
|-----|----------|
| 👤 Developer | Name, email, website, privacy policy URL, address |
| 📱 App Description | Short description (multiple languages), long description, version notes |
| ✅ Compliance Answers | Content rating, target audience, data collection policy, permission explanations |
| 📝 Custom | Any additional key-value pairs |

**Auto-fill flow:**
1. Open the profile panel (📋 button in header)
2. Fill in your info once — saved permanently to local storage
3. Navigate to any web form
4. Click **🤖 Scan current page and auto-fill**
5. The extension scans all visible form fields (input, textarea, select), sends the structure to the AI along with your stored profile, receives a fill plan, and executes it field by field

Works on any website — Google Play Console, App Store Connect, company intranets, registration forms, etc. Uses generic DOM scanning, not site-specific code.

### 5. Image Paste & Vision Analysis

Users can send screenshots directly to the AI for visual analysis:

- **Paste**: Copy a screenshot (system ⌘⇧4 on Mac, Win+Shift+S on Windows), then press ⌘V / Ctrl+V in the chat input
- **Upload**: Click 🖼️ Image button → file picker
- Up to **4 images per message**
- Thumbnail preview strip shown before sending — click × to remove, click thumbnail to zoom
- Images sent using each provider's native vision format (Anthropic `base64` source / OpenAI `image_url`)
- Images not stored in conversation history (saves tokens)

Use case: Take a system screenshot of a protected page (Chrome Web Store, PDF), paste it into the chat, ask the AI to analyze the form fields and draft fill content.

### 6. Auto-Screenshot Injection

When the user asks about page content (detected via keywords: fill, analyze table, see this page, form fields, etc.) or the page text is empty (SPA like Twitter/GitHub), the extension automatically:

1. Takes a screenshot of the current tab
2. Attaches it to the AI message alongside the text
3. Lets the AI "see" the page visually

This runs silently in the background and only triggers for relevant queries.

### 7. Quick Action Buttons

Five one-click shortcuts in the toolbar below the page context bar:

- 📝 Summarize — summarize the page in Chinese
- 🔑 Key Points — extract 5 key points as a list
- 🌐 Translate — translate main content to Chinese
- 🔬 Analyze — deep analysis of arguments, data, and conclusions
- ❓ Explain — explain core concepts in plain language

### 8. Bridge Mode (Advanced / Optional)

For users running a local Hermes Agent, the extension can connect via WebSocket:

```bash
pip3 install websockets
python3 bridge-server.py --port 8643
```

Then in Settings → Bridge section → Connect. The agent can then send browser commands (navigate, click, fill, screenshot, extract, scroll, tab management) to the extension remotely. This is fully optional — all other features work without it.

---

## Permissions Used

| Permission | Why |
|-----------|-----|
| `activeTab` | Read page content and take screenshots when user triggers an action |
| `tabs` | Get current tab URL and title for page context; navigate tabs |
| `storage` | Save API keys, model selection, conversation history, and profile data locally |
| `sidePanel` | Display the AI chat panel on the right side of the browser |
| `contextMenus` | Add "Summarize with Hermes AI" and "Analyze with Hermes AI" to the right-click menu |
| `alarms` | Keep the service worker alive for Bridge WebSocket reconnection |
| `scripting` | Inject content script into pages that didn't load it automatically |
| `<all_urls>` (host) | Read page content and interact with elements on any website |
| `api.deepseek.com` | DeepSeek AI API calls |
| `api.openai.com` | OpenAI API calls |
| `api.anthropic.com` | Anthropic Claude API calls |
| `generativelanguage.googleapis.com` | Google Gemini API calls |
| `api.x.ai` | xAI Grok API calls |
| `api.moonshot.ai` | Kimi (Moonshot) API calls |

All API calls go directly from the user's browser to the selected provider using the user's own API key. No proxy, no backend, no data collection.

---

## Privacy

- **No data collection** — nothing is sent to any server controlled by Hermes
- **User-owned API keys** — keys stored in Chrome local storage, never transmitted except to the chosen AI provider
- **No analytics or tracking** — no telemetry, no crash reporting, no usage metrics
- **Page content stays local** — page text is included in AI requests only when the user initiates a query; it is not cached or stored beyond the conversation session
- **Images not stored** — pasted images are used for the current message only, not saved to conversation history
- **Bridge mode is local-only** — WebSocket connects to `127.0.0.1` only

Privacy Policy: https://raw.githubusercontent.com/simonwar119-wq/hermes-browser-bridge/main/PRIVACY_POLICY.md

---

## Architecture

```
Chrome Side Panel (sidepanel.js)
    │
    ├── AI Chat ──────────────────→ Provider API (DeepSeek / OpenAI / Claude / Gemini / Grok / Kimi)
    │                                   ↑ Streaming SSE
    ├── Browser Actions ──────────→ Service Worker (service-worker.js)
    │   (screenshot, navigate,         │
    │    click, fill, scan_forms)       └──→ Content Script (content.js)
    │                                         DOM: read, click, fill, scroll, scan, structure
    └── Bridge Mode (optional) ───→ WebSocket ws://127.0.0.1:8643 ←→ Hermes Agent
```

### File Structure

```
hermes浏览器插件/
├── manifest.json           MV3 extension manifest
├── service-worker.js       Background: browser actions, Bridge WebSocket, tab capture
├── content.js              Injected: DOM read, structured read, form scan, click, fill, scroll
├── popup/
│   ├── popup.html          Toolbar icon popup: open side panel, Bridge status
│   └── popup.js
├── sidepanel/
│   ├── sidepanel.html      Main chat UI, model dropdown, toolbar, profile panel
│   └── sidepanel.js        Chat logic, multi-provider streaming, vision, auto-fill orchestration
├── icons/
├── bridge-server.py        Optional local WebSocket server for Hermes Agent integration
├── PRIVACY_POLICY.md
├── store-submission.md
└── README.md
```

---

## Chrome Web Store Listing Copy

### Short Description (≤132 characters)
```
AI chat & browser controller in a side panel. Multi-model (DeepSeek/GPT/Claude/Gemini/Grok/Kimi). Smart form auto-fill.
```

### Category
Productivity

### Single Purpose Statement
```
Hermes AI Assistant provides an AI-powered side panel chat that reads the current web page and lets users interact with it: ask questions, summarize content, and control the browser (navigate, screenshot, click, fill forms). Users configure their own API keys for supported AI providers; all processing happens between the user's browser and their chosen AI provider.
```

### Detailed Description
```
Hermes AI Assistant — AI Chat & Browser Controller

Open the side panel (right-click the extension icon or click the toolbar button) to chat with your chosen AI model about any web page — and to control your browser directly from the panel.

🤖 Multi-Model AI Chat (requires your own API key)
• Supports 6 providers: DeepSeek, OpenAI, GPT-5, Claude, Gemini, Grok, and Kimi
• Switch provider and model with one click from the header badge
• Streams responses with full Markdown rendering
• Reads the page's structured content: headings, tables (as Markdown), and form fields

📋 Smart Form Auto-Fill
• Store your profile once (developer info, app descriptions, compliance answers, custom fields)
• On any form page, click 🤖 to scan all visible fields and have the AI match your data to the right fields
• Works on any website: app store submissions, registration forms, company portals

📷 Screenshot & Vision
• Click 📷 or type "截图" to capture the current tab and view it inline in chat
• Paste any system screenshot (⌘V / Ctrl+V) or upload an image file — it's sent to the AI as a vision message
• Ideal for Chrome-protected pages that can't be read by the content script

🖥️ Browser Actions
• Navigate to any URL from the chat
• Click elements by CSS selector
• Fill form fields with human-like typing simulation
• Direct commands: "导航到 google.com", "点击 #submit", "填写 #email test@example.com"

🔌 Bridge Mode (Advanced, Optional)
• Connect a local Hermes Agent via WebSocket for external browser automation

🔒 Privacy First
• Your API keys are stored locally in Chrome — never sent anywhere except your chosen AI provider
• No tracking, no analytics, no backend
• Page content is only included in AI requests when you initiate a query
```

---

## Development

```bash
# Load unpacked in Chrome
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked" → select this directory

# After code changes: click the ↺ refresh button on the extension card
```

Built for Hermes Agent users and power users who want AI in their browser without switching windows.
