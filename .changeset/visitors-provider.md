---
"@stacksee/analytics": minor
---

Add `VisitorsClientProvider` for [visitors.now](https://visitors.now) analytics.

- Dynamically loads `cdn.visitors.now/v.js` with your project token — no npm dependency required
- Supports `track()`, `identify()`, `pageLeave()` (page views are handled automatically by the script)
- `getVisitorId()` helper reads the `visitor` cookie for Stripe revenue attribution
- Full E2E test suite (Playwright) and unit tests (vitest/jsdom) included
