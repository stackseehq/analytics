---
"@stacksee/analytics": patch
---

Fix `VisitorsClientProvider` 429 Too Many Requests errors in production.

**Concurrent init race**: `initialize()` now coalesces concurrent calls onto a single in-flight Promise instead of checking a boolean flag that is only set after async work completes. Previously, two callers entering simultaneously each injected the script and triggered duplicate automatic page-view POSTs to `e.visitors.now/e`.

**Identify deduplication**: `identify()` now skips the SDK call when the same user ID has already been sent in the current session. Calling `analytics.identify(user)` on every route change (a common Next.js layout pattern) no longer fires a network request on each navigation.
