---
"@stacksee/analytics": patch
---

Add `persist` option to `VisitorsClientProvider`. When `persist: true`, the `data-persist` attribute is set on the injected script tag, enabling the visitor cookie required for cross-session tracking and Stripe revenue attribution via `getVisitorId()`.
