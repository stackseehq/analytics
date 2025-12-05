---
"@stacksee/analytics": minor
---

Add flexible channel routing to EmitKit provider

Adds powerful channel routing capabilities to the EmitKit provider, allowing users to organize events across different EmitKit channels (similar to Slack channels) automatically.

**New Features:**

- **Default channel configuration**: Set a global default channel for all events (now defaults to `'general'` instead of `'analytics'`)
- **Category-based channel mapping**: Automatically route events to specific channels based on their category using the new `categoryChannelMap` option
- **Per-event channel override**: Override the channel for specific events using the `__emitkit_channel` property
- **Priority-based resolution**: Clear 3-tier priority system ensures predictable channel routing

**Channel Resolution Priority:**
1. Event property `__emitkit_channel` (highest priority - per-event override)
2. Category mapping via `categoryChannelMap` (category-based routing)
3. Default `channelName` (fallback, defaults to `'general'`)

**Example Usage:**

```typescript
// Basic: Set a default channel
const analytics = createServerAnalytics({
  providers: [
    new EmitKitServerProvider({
      apiKey: 'emitkit_...',
      channelName: 'app-events' // All events go here
    })
  ]
});

// Advanced: Category-based routing
const analytics = createServerAnalytics({
  providers: [
    new EmitKitServerProvider({
      apiKey: 'emitkit_...',
      channelName: 'general', // Fallback channel
      categoryChannelMap: {
        'user': 'user-activity',      // All user events → user-activity
        'engagement': 'product-usage', // All engagement → product-usage
        'error': 'alerts',             // All errors → alerts
        'conversion': 'revenue'        // All conversions → revenue
      }
    })
  ]
});

// Per-event override
analytics.track('payment_processed', {
  amount: 100,
  currency: 'USD',
  __emitkit_channel: 'critical-payments' // Override to critical channel
});
```

**Benefits:**
- Organize events like Slack channels for better team visibility
- Automatic routing based on event categories (user, engagement, error, etc.)
- Flexible per-event overrides for critical events
- Works with both `track()` and `pageView()` methods

**Breaking Changes:** None - fully backward compatible. The default channel changes from `'analytics'` to `'general'`, but this is a soft change that only affects new installations.
