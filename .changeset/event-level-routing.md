---
"@stacksee/analytics": minor
---

Add event-level provider routing system

Extends the existing provider routing system with event-level filtering, solving the "1-to-50 problem" where you need to route specific events to specific providers without excluding 49 other events.

**New Features:**

- **Event whitelisting**: Use the `events` option to specify which events should be tracked on a provider
- **Event blacklisting**: Use the `excludeEvents` option to exclude specific events from a provider
- **Event pattern matching**: Use the `eventPatterns` option with glob-style patterns (e.g., `newsletter_*`) for flexible event routing
- **Combined routing**: Mix method routing (`methods`, `exclude`) with event routing for fine-grained control
- **Full TypeScript support**: Method routing has full autocomplete and type safety
- **Client & Server**: Works on both client-side and server-side analytics

**Example Usage:**

```typescript
const analytics = createServerAnalytics({
  providers: [
    // All events go to PostHog
    new PostHogServerProvider({ token: "xxx" }),

    // Only newsletter_signup goes to EmitKit
    {
      provider: new EmitKitServerProvider({ apiKey: "xxx" }),
      events: ["newsletter_signup"], // Just 1 event instead of excluding 49!
      methods: ["track"] // Optional: also skip identify/pageView
    },

    // Only newsletter events (using patterns)
    {
      provider: new CustomEmailProvider({ apiKey: "xxx" }),
      eventPatterns: ["newsletter_*"] // Matches newsletter_signup, newsletter_unsubscribe, etc.
    },

    // Everything except page views
    {
      provider: new BentoServerProvider({ siteUuid: "xxx" }),
      excludeEvents: ["page_view"]
    }
  ]
});
```

**Breaking Changes:** None - fully backward compatible with existing code.

**Note:** Event names (`events`, `excludeEvents`, `eventPatterns`) currently accept any string. Future enhancement could add type safety based on the event map passed to `createServerAnalytics<TEventMap>()` or `createClientAnalytics<TEventMap>()`.
