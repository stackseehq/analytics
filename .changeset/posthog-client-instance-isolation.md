---
"trakoo": patch
---

Initialize each PostHog browser provider with its own named SDK instance so
configuration, identity, capture, and reset state do not leak between Trakoo
instances.
