# Hermes AI Assistant Roadmap

This roadmap is intended to help contributors understand where the project is heading.

## Now

- stabilize page reading on normal websites
- improve browser action reliability
- improve repository documentation and contributor workflow
- make Chrome Web Store review posture clearer and easier to maintain
- reduce unnecessary permission surface where possible

## Next

- improve structured page extraction
- improve form auto-fill quality on real-world dashboards and submission forms
- add safer fallback flows for protected pages
- improve provider diagnostics and setup UX
- add more robust test scenarios and sample pages

## Later

- optional site-specific adapters for high-value workflows
- stronger evaluation harness for page-read/action success
- better export flows for generated content
- improved onboarding for first-time users
- more complete Bridge + external agent workflow docs

## Contribution Targets

Good places to contribute right now:

- `content.js` selector robustness
- `service-worker.js` action reliability
- `sidepanel/sidepanel.js` model UX and prompt orchestration
- docs and demo materials
- permission review and simplification ideas

## Non-goals for Now

- adding a hosted proxy backend
- turning the project into an analytics product
- hiding model/provider behavior from users
- broadening permissions without a strong product reason
