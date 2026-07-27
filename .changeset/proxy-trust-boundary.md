---
"trakoo": major
---

Replace the proxy wire format with version 2. Proxy track events now carry raw
registry input for server-side validation, and server identity must be derived
with `resolveIdentity` instead of trusting browser claims.
