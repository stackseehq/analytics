---
"@stacksee/analytics": patch
---

Fix proxy provider queue flushing and add manual flush support

**Bug Fixes:**

- **Fixed event loss in proxy provider**: Events were being lost when users triggered only 1-2 events because the flush timer wasn't resetting properly. The timer now resets with each new event, ensuring events are flushed after the configured interval from the last event.
- **Reduced default batch interval**: Changed default `batchInterval` from 5000ms to 2000ms for better responsiveness and fewer lost events.

**New Features:**

- **Added `flush()` method**: New method on `BrowserAnalytics` and convenience export from client to manually flush all queued events to providers. This is particularly useful for ensuring critical events are sent before navigation or page unload.

**Example Usage:**

```typescript
// Ensure critical events are sent before navigation
await analytics.track('purchase_completed', { orderId: '123' });
await analytics.flush(); // Wait for confirmation
window.location.href = '/thank-you';

// Or use with beacon API for page unload
await analytics.flush(true); // Uses beacon API for reliability
```

**Technical Details:**

- Added optional `flush(useBeacon?: boolean)` method to `AnalyticsProvider` interface
- Proxy provider's `beforeunload` and `visibilitychange` listeners automatically call `flush(true)` with beacon API for reliable delivery during page transitions
- All providers that implement batching can now be manually flushed
