---
"@stacksee/analytics": patch
---

Fix fire-and-forget pageView/identify causing AbortError on Vercel

On Vercel (and other serverless platforms), when an API route returns its HTTP
response, the Node.js process is frozen immediately. Any pending async work that
wasn't awaited gets aborted with `DOMException [AbortError]: This operation was aborted`.

The root cause was that `pageView` and `identify` were fire-and-forget at every
layer of the stack:

- `PirschServerProvider.pageView/identify` — called `this.request().catch()` without awaiting
- `EmitKitServerProvider.pageView/identify` — called SDK methods with `.then().catch()` without awaiting
- `BentoServerProvider.pageView/identify` — called SDK methods with `.catch()` without awaiting
- `ServerAnalytics.pageView/identify` — did not await provider calls
- `ingestProxyEvents` — did not await `analytics.pageView/identify`

This meant that when the proxy handler returned `200 OK`, Vercel froze the process
before the OAuth token fetch or API hit could complete, causing the abort.

Fix: all `pageView` and `identify` methods now return `Promise<void>` and are
properly awaited through the full call chain.
