---
"@stacksee/analytics": minor
---

Add provider routing system for selective method control

Introduces a new provider routing system that allows fine-grained control over which methods are called on specific providers. This enables scenarios like using Bento only for user identification and custom events while excluding page views to reduce noise.

**New Features:**

- **Selective method inclusion**: Use the `methods` option to specify which methods should be called on a provider
- **Method exclusion**: Use the `exclude` option to prevent specific methods from being called
- **Mixed provider configurations**: Combine simple providers with routed providers in the same setup
- **Full TypeScript support**: Type-safe method names with autocomplete

**Example Usage:**

```typescript
const analytics = createClientAnalytics({
  providers: [
    // Simple form - gets all methods
    new PostHogClientProvider({ token: 'xxx' }),

    // Exclude page views from Bento
    {
      provider: new BentoClientProvider({ siteUuid: 'xxx' }),
      exclude: ['pageView']
    },

    // CRM only needs identity data
    {
      provider: new CustomCRMProvider({ apiKey: 'xxx' }),
      methods: ['identify']
    }
  ]
});
```

**Breaking Changes:** None - fully backward compatible with existing code.
