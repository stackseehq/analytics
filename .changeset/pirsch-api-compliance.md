---
"@stacksee/analytics": patch
---

Fix Pirsch server provider for full API compliance

- Fix `event_meta` to use string values only (API requirement)
- Remove invalid fallback URLs in `buildHit()`
- Add `disableBotFilter` config option
- Add `non_interactive` event support
- Mark synthetic events (`identify`, `reset`) as non-interactive
