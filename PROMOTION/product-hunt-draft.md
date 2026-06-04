# Product Hunt 发布草稿

**发布时间建议**：周二或周三，美西时间 08:00（北京时间 23:00 / 00:00）

---

## 基本信息

**Name**: Hermes AI Assistant

**Tagline** (60 chars max):
```
AI side panel: chat any page, auto-fill forms, 6 models
```

**Topics**: Artificial Intelligence · Productivity · Chrome Extensions · Browser Extensions

**Website**: https://github.com/simonwar119-wq/hermes-browser-bridge  
（或填 Chrome Web Store 链接）

---

## Description (Product Hunt 详情页正文)

```
Hermes AI Assistant is a Chrome side panel extension that combines AI chat with direct browser control.

**The problem it solves**
I was tired of copy-pasting page content into ChatGPT, and even more tired of filling the same compliance forms and app store submissions over and over.

**What it does**

🤖 AI Chat about the current page
The extension reads the page's structured content — headings, tables (converted to Markdown), form fields — and includes it in the AI's context. Ask questions about any page without leaving it.

📋 Smart Form Auto-Fill
Store your profile once (developer info, app descriptions, compliance answers). On any form page, one click scans all visible fields, sends the structure to the AI, and fills them automatically. Works on any website — not site-specific code.

📷 Screenshot Vision
Paste a system screenshot directly into the chat (Cmd+V). The AI sees it visually — useful for pages that block extensions, like Chrome Web Store admin or PDFs.

🔀 6 AI Providers, One Click to Switch
DeepSeek V4 · GPT-5.5/5.4 · Claude Opus 4.8 · Gemini 3.x · Grok 4 · Kimi K2
Your own API key. No proxy, no backend, no subscription.

🔒 Privacy First
API keys stored locally. Page content only sent when you initiate a query. No analytics, no telemetry.

GitHub: https://github.com/simonwar119-wq/hermes-browser-bridge
```

---

## First Comment（发布后第一条评论，自己写，非常重要）

```
Hi PH! 👋 I'm the maker of Hermes AI Assistant.

I built this because I submit to multiple app stores and fill compliance forms constantly — copy-pasting the same info into the same fields over and over.

The "aha moment" was when I realized I could store my developer profile once, scan any form page, and have the AI match my data to the right fields automatically. Saved me probably 2-3 hours on my last Chrome Web Store submission.

A few things that were surprisingly tricky to build:
- Chrome Web Store and chrome:// pages block content scripts entirely — that's why I added clipboard screenshot pasting as a fallback
- Getting `captureVisibleTab` to work reliably when the side panel is open required using `lastFocusedWindow` instead of `null` for the window ID
- Chrome treats `console.warn()` in extension scripts as "errors" in the extension dashboard — caused confusion during review

Would love feedback on what's missing! What forms do you fill most often that you wish were automatic?
```

---

## Thumbnail / Gallery 建议截图顺序

1. 侧边栏全貌（模型下拉 + 聊天界面）
2. 智能填表流程（扫描 → AI 分析 → 自动填写）
3. 粘贴截图到对话框（Vision 功能）
4. 6个模型 Provider 下拉

---

## Hunter 寄语（如果找 hunter 帮发）

```
Subject: Would you hunt Hermes AI Assistant?

Hi [Hunter],

I built a Chrome side panel extension that combines AI chat with browser control — the part I'm most proud of is the smart form auto-fill: store your profile once, and it auto-fills any web form using AI.

Supports 6 AI providers (DeepSeek/GPT-5/Claude/Gemini/Grok/Kimi), paste screenshots for visual AI analysis, and it's fully local — no backend.

GitHub: https://github.com/simonwar119-wq/hermes-browser-bridge

Would be honored if you'd hunt it. Happy to answer any questions!
```
