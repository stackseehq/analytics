---
"trakoo": patch
---

Initialize each PostHog browser provider with its own named SDK object,
isolating live configuration and identify, capture, and reset method dispatch
while preserving PostHog's token- and `persistence_name`-based storage
semantics.
