---
"@stacksee/analytics": patch
---

fix(pirsch): externalize pirsch-sdk from library build

`pirsch-sdk` was not listed in `rollupOptions.external`, causing Vite to bundle it into an internal chunk (`web-D-ZwlgeQ.js`) and load it via a relative dynamic import. When consumers re-bundled the library (e.g. with Vite/Astro), the relative path broke and `PirschClientProvider.initialize()` failed with `Cannot destructure property 'Pirsch' of undefined`.

`pirsch-sdk` and `pirsch-sdk/web` are now externalized so the consumer's bundler resolves them directly.
