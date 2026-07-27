---
"trakoo": patch
---

Prevent Bento and EmitKit server providers from retaining one request's user
identity for later events. Server events now use only identity supplied on the
current call.
