# Reddit 发帖内容

---

## r/ChatGPT  
**Title**: I built a Chrome side panel that lets you chat with GPT/Claude/Gemini about any page + auto-fill forms with AI

**Body**:

Been annoyed by having to copy-paste page content into ChatGPT, so I built a Chrome extension that reads the page for you.

**What it does:**

The extension opens as a side panel. It extracts structured content from the current page (headings, tables → Markdown, form fields) and includes it in the AI's context. You can ask questions about the page without copying anything.

**The part I'm most excited about — auto form fill:**

I submit to a lot of app stores and fill compliance forms. I store my info once (developer details, app descriptions, compliance answers) and click "scan + auto-fill" on any form page. The extension scans all visible fields, sends the structure to the AI, gets a fill plan back, and executes it.

For pages where the content script can't run (like Chrome Web Store), you can paste a system screenshot directly into the chat with Cmd+V and have the AI analyze it visually.

**Supported models**: DeepSeek V4, GPT-5.5/5.4, Claude Opus 4.8, Gemini 3.x, Grok 4, Kimi K2 — one click to switch, your own API key, no proxy.

Chrome Web Store: [Hermes AI Assistant]  
GitHub: https://github.com/simonwar119-wq/hermes-browser-bridge

Happy to answer questions!

---

## r/SideProject  
**Title**: Built a Chrome AI side panel with smart form auto-fill — 6 models, paste screenshots, browser control

**Body**:

After months of filling the same forms over and over (app store submissions, compliance questionnaires), I finally built something to fix it.

**Hermes AI Assistant** — Chrome side panel extension

Core features:
- Chat with DeepSeek/GPT-5/Claude/Gemini/Grok/Kimi about the current page (reads structured content: tables, forms, headings)
- Store your profile once → scan any web form → AI auto-fills all fields
- Paste screenshots (Cmd+V) for pages content scripts can't access — AI sees it visually
- Browser control: navigate, click elements, fill inputs from the chat panel
- Screenshot → inline in chat

Stack: Chrome Extension MV3, vanilla JS, service worker, WebSocket bridge for agent mode.

What went wrong during development: Chrome Web Store rejected it twice — once because the popup's "AI Mode" silently failed (was using a Gemini Nano API that wasn't in the manifest), second time because `console.warn()` logs were showing up as "errors" in the extension dashboard. Fixed both.

GitHub: https://github.com/simonwar119-wq/hermes-browser-bridge

---

## r/productivity  
**Title**: Chrome extension that auto-fills any web form using AI + your stored profile data

**Body**:

If you regularly fill the same types of forms (app store submissions, compliance docs, registration pages, internal dashboards), this might save you a lot of time.

**Hermes AI Assistant** lets you:

1. Store your info once — developer details, app descriptions, compliance answers, any custom key-value pairs
2. Navigate to any web form
3. Click one button — it scans all visible fields, sends the structure to an AI (your choice of DeepSeek/GPT-5/Claude etc.), and fills them all automatically

It also reads the current page's content (tables, headings, forms) so you can ask the AI questions about what you're looking at without copy-pasting.

For pages that block extensions (like Chrome Web Store admin), you can take a system screenshot and paste it directly into the chat — the AI sees it visually and helps you figure out what to write.

Free to use with your own API key. No subscription, no backend.

Chrome Web Store: [Hermes AI Assistant]  
GitHub: https://github.com/simonwar119-wq/hermes-browser-bridge
