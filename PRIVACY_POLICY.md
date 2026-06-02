# Hermes AI Assistant Privacy Policy

Last updated: June 2, 2026

## Overview

Hermes AI Assistant is a Chrome extension that provides:

- AI chat about the current webpage
- Browser actions initiated by the user, such as reading page text, taking screenshots, navigating, clicking, scrolling, and filling forms
- Optional local Bridge mode for connecting to a local Hermes Agent service running on the user's machine

The extension does not operate its own backend proxy. When AI features are used, requests go directly from the user's browser to the AI provider selected and configured by the user.

## Data We Collect

Hermes AI Assistant does not collect, sell, or share user data for the developer's own purposes.

We do not run analytics, tracking, advertising, telemetry, or remote logging.

## Data Processed by the Extension

Depending on which features the user actively invokes, the extension may process:

- Current page title and URL
- Visible page text
- User-entered chat messages
- User-provided API keys for supported AI providers
- User-provided profile/form-fill data stored locally in Chrome
- User-selected attachments that they explicitly add to a chat message
- Screenshots captured by the user

This processing happens locally in the browser except when the user explicitly sends an AI request.

## How Data Is Used

The extension uses data only to provide the user-requested functionality:

- To answer questions about the current page
- To summarize, analyze, translate, or explain webpage content
- To carry out browser actions requested by the user
- To help fill forms using user-supplied profile information
- To connect to a local Bridge service if the user enables Bridge mode

## AI Providers and Data Transfer

When the user sends a chat request, relevant content may be sent directly to the AI provider chosen by the user. This can include:

- The user's message
- The current page title and URL
- Page text excerpted from the current tab
- User-attached text files or excerpts

Supported providers may include:

- DeepSeek
- OpenAI
- Anthropic
- Google Gemini
- xAI Grok
- Moonshot / Kimi

The extension does not forward these requests through any Hermes-controlled server.

Users are responsible for reviewing the privacy terms of the AI provider they choose to use.

## Local Storage

The extension stores the following locally in Chrome storage on the user's device:

- API keys entered by the user
- Selected provider and model
- Recent conversation history
- Form-fill profile data entered by the user
- Optional Bridge host configuration

These items are stored locally for product functionality and are not uploaded to any Hermes-controlled server.

## Bridge Mode

If the user enables Bridge mode, the extension connects only to a local service endpoint, such as:

- `ws://127.0.0.1:8643`

Bridge mode is optional and is intended for local automation only.

## Permissions

The extension requests browser permissions only to support user-invoked features:

- `activeTab`: access the current tab when the user invokes an action
- `tabs`: read tab metadata and navigate or activate tabs
- `scripting`: inject the content script when needed on normal webpages
- `storage`: save user settings locally
- `sidePanel`: display the extension interface in the browser side panel
- `contextMenus`: provide right-click shortcuts
- `alarms`: keep the optional Bridge reconnection logic alive
- `<all_urls>`: read or interact with webpages when the user requests it

## What We Do Not Do

We do not:

- Sell user data
- Use user data for advertising
- Use user data for credit or lending decisions
- Build behavioral profiles
- Collect browsing history for analytics
- Send data to a developer-owned backend for storage or analysis

## User Control

Users control whether to:

- Enter an API key
- Send a chat request
- Attach files
- Capture a screenshot
- Enable Bridge mode
- Save local form-fill profile data

Users may remove local settings by clearing extension storage or uninstalling the extension.

## Contact

If you have questions about this privacy policy, contact the developer through the Chrome Web Store listing or the public project repository.
