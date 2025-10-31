# Analytics Providers

This directory contains documentation for all available analytics providers and guides for creating custom providers.

## Available Providers

### [PostHog](./posthog.md)
Open-source product analytics platform with feature flags and session replay.

**Use cases:** Product analytics, feature flags, user behavior tracking, session replay

**Installation:**
```bash
pnpm install posthog-js posthog-node
```

**Quick Start:**
```typescript
import { PostHogClientProvider } from '@stacksee/analytics/providers/client';

new PostHogClientProvider({
  token: 'your-posthog-api-key',
  api_host: 'https://app.posthog.com'
})
```

[View full documentation →](./posthog.md)

---

### [Bento](./bento.md)
Email marketing and automation platform with event tracking.

**Use cases:** Email marketing, user segmentation, event-triggered campaigns

**Installation:**
```bash
# Client-side: No installation needed (CDN script)
# Server-side:
pnpm install @bentonow/bento-node-sdk
```

**Quick Start:**
```typescript
import { BentoClientProvider } from '@stacksee/analytics/providers/client';

new BentoClientProvider({
  siteUuid: 'your-bento-site-uuid'
})
```

[View full documentation →](./bento.md)

---

### [Pirsch](./pirsch.md)
Privacy-focused, cookie-free web analytics platform.

**Use cases:** Privacy-compliant analytics, GDPR-friendly tracking, cookie-free monitoring

**Installation:**
```bash
pnpm install pirsch-sdk
```

**Quick Start:**
```typescript
import { PirschClientProvider } from '@stacksee/analytics/providers/client';

new PirschClientProvider({
  identificationCode: 'your-pirsch-identification-code'
})
```

[View full documentation →](./pirsch.md)

---

### [Proxy Provider](./proxy.md)
Route client-side events through your own server to bypass ad-blockers and gain server-side control.

**Use cases:** Ad-blocker bypass, server-side enrichment, privacy control, unified tracking

**Installation:**
```bash
# No additional dependencies - included in core library
```

**Quick Start:**
```typescript
// Client-side
import { ProxyProvider } from '@stacksee/analytics/providers/client';

new ProxyProvider({
  endpoint: '/api/events',
  batch: { size: 10, interval: 5000 }
})

// Server-side
import { ingestProxyEvents } from '@stacksee/analytics/providers/server';

export async function POST(req: Request) {
  await ingestProxyEvents(req, serverAnalytics);
  return new Response('OK');
}
```

[View full documentation →](./proxy.md)

---

## Creating Custom Providers

Want to integrate with a different analytics service? Check out our comprehensive guide:

**[Custom Provider Guide →](./custom-providers.md)**

Learn how to:
- Implement the provider interface
- Create client-side and server-side providers
- Handle user context and events
- Follow best practices
- Test your provider

## Provider Comparison

| Feature | PostHog | Bento | Pirsch |
|---------|---------|-------|--------|
| **Analytics** | ✅ Advanced | ✅ Basic | ✅ Privacy-focused |
| **Email Marketing** | ❌ | ✅ | ❌ |
| **Feature Flags** | ✅ | ❌ | ❌ |
| **Session Replay** | ✅ | ❌ | ❌ |
| **User Segmentation** | ✅ | ✅ | ⚠️ Limited |
| **Real-time Events** | ✅ | ⚠️ 1-3min delay | ✅ |
| **Cookie-Free** | ❌ | ❌ | ✅ |
| **Privacy-First** | ⚠️ Configurable | ⚠️ Standard | ✅ GDPR Native |
| **Self-hosted Option** | ✅ | ❌ | ✅ |
| **Free Tier** | ✅ Generous | ✅ Limited | ✅ Trial |

## Using Multiple Providers

You can use multiple providers simultaneously to combine different analytics capabilities:

```typescript
import { createClientAnalytics } from '@stacksee/analytics/client';
import { PostHogClientProvider } from '@stacksee/analytics/providers/client';
import { BentoClientProvider } from '@stacksee/analytics/providers/client';

const analytics = createClientAnalytics({
  providers: [
    // PostHog for product analytics and feature flags
    new PostHogClientProvider({
      token: process.env.POSTHOG_KEY
    }),

    // Bento for email marketing automation
    new BentoClientProvider({
      siteUuid: process.env.BENTO_SITE_UUID
    })
  ]
});

// Events are sent to all providers
analytics.track('user_signed_up', {
  plan: 'pro'
});
```

## Environment-Specific Imports

**Important:** Always use the correct import path to avoid bundling issues:

### Client-Side (Browser)
```typescript
import { PostHogClientProvider, BentoClientProvider } from '@stacksee/analytics/providers/client';
```
- ✅ Only includes browser-compatible providers
- ✅ No Node.js dependencies in bundle
- ✅ Optimized for client-side usage

### Server-Side (Node.js)
```typescript
import { PostHogServerProvider, BentoServerProvider } from '@stacksee/analytics/providers/server';
```
- ✅ Only includes Node.js providers
- ✅ Supports server-specific features
- ✅ Includes shutdown methods for cleanup

### Universal (Not Recommended)
```typescript
import { PostHogClientProvider } from '@stacksee/analytics/providers';
```
- ⚠️ May include both client and server code
- ⚠️ Can cause bundling issues
- ⚠️ Only use if you know what you're doing

## Provider Configuration Best Practices

### 1. Use Environment Variables
```typescript
new PostHogClientProvider({
  token: import.meta.env.VITE_POSTHOG_KEY,  // Vite
  // OR
  token: process.env.NEXT_PUBLIC_POSTHOG_KEY  // Next.js
})
```

### 2. Enable Debug Mode in Development
```typescript
new PostHogClientProvider({
  token: 'xxx',
  debug: import.meta.env.DEV  // or process.env.NODE_ENV === 'development'
})
```

### 3. Conditional Providers
```typescript
const providers = [
  // Always include PostHog
  new PostHogClientProvider({ token: 'xxx' })
];

// Only add Bento in production
if (import.meta.env.PROD) {
  providers.push(new BentoClientProvider({ siteUuid: 'xxx' }));
}

const analytics = createClientAnalytics({ providers });
```

### 4. Graceful Degradation
```typescript
const analytics = createClientAnalytics({
  providers: [
    new PostHogClientProvider({
      token: 'xxx',
      enabled: !!import.meta.env.VITE_POSTHOG_KEY  // Disable if no key
    })
  ]
});
```

## Getting Help

- **PostHog:** [PostHog Documentation](https://posthog.com/docs) | [PostHog Community](https://posthog.com/questions)
- **Bento:** [Bento Documentation](https://docs.bentonow.com/) | [Bento Support](https://bentonow.com/support)
- **Custom Providers:** [Create an issue](https://github.com/stackseehq/analytics/issues)

## Contributing

Want to contribute a provider? We welcome contributions!

1. Create your provider following the [Custom Provider Guide](./custom-providers.md)
2. Add comprehensive documentation (see existing provider docs)
3. Include TypeScript types and JSDoc comments
4. Add tests
5. Submit a pull request

See our [Contributing Guide](../../CONTRIBUTING.md) for more details.
