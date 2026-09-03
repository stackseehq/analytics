---
"trakoo": minor
---

Report OpenPanel delivery failures instead of dropping them. OpenPanel's SDKs answer an HTTP 401 by returning `null` without throwing, retrying or logging, so a wrong client ID, a rotated secret or a browser origin the project does not allow stopped analytics silently. Both OpenPanel providers now accept `onDeliveryFailure` and log rejections when no handler is configured. The failure reports the reason, status, attempt count, envelope type and ingestion URL, never event properties, and delivery still resolves so a rejected event never becomes an application error.
