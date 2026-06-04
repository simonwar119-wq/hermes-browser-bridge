# Contributing to Hermes AI Assistant

Thanks for considering a contribution.

Hermes AI Assistant is meant to be a practical open-source browser AI operator: local-first, bring-your-own-key, and transparent about permissions. Contributions should strengthen that direction rather than weaken it.

## What Helps Most

- bug reports with reproducible steps
- improvements to page reading and DOM interaction
- better form scanning and fill-plan quality
- permission reduction without breaking core workflows
- provider compatibility fixes
- UI copy and onboarding improvements
- test pages and real-world compatibility reports
- documentation and examples

## Before You Start

Please keep these project principles in mind:

- no developer-owned proxy for model traffic
- no hidden analytics or telemetry
- prefer local-first behavior
- permission changes must be justified clearly
- avoid large refactors unless they solve a concrete problem

## Local Setup

1. Clone the repository
2. Open `chrome://extensions`
3. Enable `Developer mode`
4. Click `Load unpacked`
5. Select the project folder
6. Make changes
7. Refresh the extension in Chrome before retesting

If you want Bridge mode:

```bash
pip3 install websockets
python3 bridge-server.py --port 8643
```

## Development Notes

- Main side panel logic: `sidepanel/sidepanel.js`
- Browser action routing: `service-worker.js`
- DOM read/write logic: `content.js`
- Optional local Bridge server: `bridge-server.py`

The extension currently uses plain HTML/CSS/JavaScript. There is no build pipeline required for normal development.

## Pull Request Guidelines

Please try to keep pull requests:

- small
- focused
- easy to review
- aligned with the current product direction

Include:

- what changed
- why it changed
- how you tested it
- whether permissions, API behavior, or privacy behavior changed

## Good PR Examples

- Fix page read failure on a normal website
- Improve selector handling for a form action
- Reduce permission scope without breaking browser control
- Improve provider error messaging
- Improve README or contributor docs

## Changes That Need Extra Care

- permission changes in `manifest.json`
- anything that expands data access
- provider integration changes
- changes that affect Chrome Web Store review posture
- Bridge behavior changes

## Testing Checklist

Before opening a PR, if relevant, test:

- side panel opens correctly
- at least one model can answer
- normal page read works
- screenshot works
- click/fill/scroll actions still work
- protected pages fail gracefully
- settings save/load still work

## Reporting Bugs

When filing an issue, include:

- Chrome version
- operating system
- extension version
- target website
- exact prompt or action
- expected result
- actual result
- screenshots if useful

## Feature Requests

Feature requests are welcome, especially if they improve:

- browser reliability
- UX clarity
- open-source maintainability
- privacy clarity
- contributor friendliness

## Code of Conduct

Be respectful, specific, and technically honest.

The goal is to make Hermes better, not noisier.
