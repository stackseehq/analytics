---
"trakoo": patch
---

Retain proxy events until transport acceptance, serialize concurrent flushes,
bound batch latency from the first event, and await in-flight delivery during
shutdown.
