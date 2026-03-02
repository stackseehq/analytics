---
"@stacksee/analytics": patch
---

fix(pirsch): rewrite client provider to use CDN script injection

The previous `PirschClientProvider` incorrectly used `pirsch-sdk` (a
Node.js npm package) to instantiate a `PirschWebClient` class in the
browser. This caused `TypeError: e is not a constructor` at runtime
because the CJS class cannot be used in a browser bundle.

The provider now follows the same pattern as `VisitorsClientProvider`:
- Dynamically injects `https://api.pirsch.io/pa.js` into `<head>`
- Waits for the `window.pirsch()` global function to become available
- Tracks events via `pirsch(eventName, { meta: { ...properties } })`
- Page views and page leave are handled automatically by pa.js

`pirsch-sdk` has been removed as a dependency entirely.
