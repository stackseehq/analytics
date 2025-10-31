# PostHog Provider

PostHog is an open-source product analytics platform. This library provides both client-side (browser) and server-side (Node.js) providers for PostHog.

## Installation

```bash
pnpm install @stacksee/analytics posthog-js posthog-node
```

## Client-Side Usage

The PostHog client provider uses the `posthog-js` SDK for browser environments.

### Basic Setup

```typescript
import { createClientAnalytics } from '@stacksee/analytics/client';
import { PostHogClientProvider } from '@stacksee/analytics/providers/client';

const analytics = createClientAnalytics({
  providers: [
    new PostHogClientProvider({
      token: 'your-posthog-project-api-key',
      api_host: 'https://app.posthog.com', // optional, defaults to PostHog cloud
      debug: false // optional, enable debug mode
    })
  ]
});

await analytics.initialize();
```

### Configuration Options

The `PostHogClientProvider` accepts all configuration options from the `posthog-js` SDK. The configuration object extends `PostHogConfig` from `posthog-js`:

```typescript
import type { PostHogConfig } from 'posthog-js';

new PostHogClientProvider({
  token: string;                    // Required: Your PostHog API key
  api_host?: string;                // Optional: PostHog instance URL
  debug?: boolean;                  // Optional: Enable debug logging
  enabled?: boolean;                // Optional: Enable/disable provider (default: true)

  // All other PostHogConfig options are also available:
  autocapture?: boolean;            // Auto-capture clicks and form submissions
  capture_pageview?: boolean;       // Auto-capture pageviews
  capture_pageleave?: boolean;      // Auto-capture page leaves
  persistence?: 'localStorage' | 'cookie' | 'memory';
  cross_subdomain_cookie?: boolean;
  secure_cookie?: boolean;
  loaded?: (posthog: PostHog) => void;
  // ... and many more options
})
```

For a complete list of configuration options, see the [PostHog JavaScript SDK documentation](https://posthog.com/docs/libraries/js).

### Example with Advanced Options

```typescript
new PostHogClientProvider({
  token: 'phc_xxxxxxxxxxxxx',
  api_host: 'https://app.posthog.com',
  autocapture: false,               // Disable autocapture
  capture_pageview: false,          // Disable automatic pageview tracking
  persistence: 'localStorage',      // Use localStorage for persistence
  loaded: (posthog) => {
    console.log('PostHog loaded:', posthog);
  }
})
```

## Server-Side Usage

The PostHog server provider uses the `posthog-node` SDK for Node.js environments.

### Basic Setup

```typescript
import { createServerAnalytics } from '@stacksee/analytics/server';
import { PostHogServerProvider } from '@stacksee/analytics/providers/server';

const analytics = createServerAnalytics({
  providers: [
    new PostHogServerProvider({
      apiKey: process.env.POSTHOG_API_KEY,
      host: 'https://app.posthog.com', // optional
      flushAt: 20,                     // optional
      flushInterval: 10000             // optional, in milliseconds
    })
  ]
});

analytics.initialize();

// Track events
await analytics.track('user_signed_up', {
  userId: 'user-123',
  plan: 'pro'
}, {
  userId: 'user-123'
});

// Important: Always shutdown to flush events
await analytics.shutdown();
```

### Configuration Options

The `PostHogServerProvider` accepts all configuration options from the `posthog-node` SDK. The configuration object extends `PostHogOptions` from `posthog-node`:

```typescript
import type { PostHogOptions } from 'posthog-node';

new PostHogServerProvider({
  apiKey: string;                   // Required: Your PostHog API key
  host?: string;                    // Optional: PostHog instance URL (default: https://app.posthog.com)
  debug?: boolean;                  // Optional: Enable debug logging
  enabled?: boolean;                // Optional: Enable/disable provider (default: true)

  // All other PostHogOptions are also available:
  flushAt?: number;                 // Number of events to queue before flushing (default: 20)
  flushInterval?: number;           // Time in ms to wait before flushing (default: 10000)
  personalApiKey?: string;          // For advanced features
  featureFlagsPollingInterval?: number;
  requestTimeout?: number;
  // ... and more options
})
```

For a complete list of configuration options, see the [PostHog Node.js SDK documentation](https://posthog.com/docs/libraries/node).

### Example with Advanced Options

```typescript
new PostHogServerProvider({
  apiKey: process.env.POSTHOG_API_KEY,
  host: 'https://app.posthog.com',
  flushAt: 10,                      // Flush after 10 events
  flushInterval: 5000,              // Or flush every 5 seconds
  requestTimeout: 3000,             // Request timeout in ms
  debug: process.env.NODE_ENV === 'development'
})
```

## Serverless Environments

When using PostHog in serverless environments (AWS Lambda, Vercel Functions, Cloudflare Workers, etc.), always call `shutdown()` to ensure events are flushed before the function terminates:

```typescript
// Vercel Functions
import { waitUntil } from '@vercel/functions';

export default async function handler(req, res) {
  const analytics = createServerAnalytics({
    providers: [new PostHogServerProvider({ apiKey: process.env.POSTHOG_API_KEY })]
  });

  analytics.initialize();

  waitUntil(
    analytics.track('api_request', { endpoint: req.url })
      .then(() => analytics.shutdown())
  );

  res.status(200).json({ success: true });
}
```

## Feature Flags

PostHog supports feature flags. To use them with the server provider:

```typescript
const provider = new PostHogServerProvider({
  apiKey: process.env.POSTHOG_API_KEY,
  personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY, // Required for feature flags
  featureFlagsPollingInterval: 30000 // Poll every 30 seconds
});

// Access the PostHog client directly if needed
// Note: This is an advanced use case
```

## Self-Hosted PostHog

If you're running a self-hosted PostHog instance, simply change the `host` or `api_host` option:

```typescript
// Client-side
new PostHogClientProvider({
  token: 'your-token',
  api_host: 'https://posthog.yourcompany.com'
})

// Server-side
new PostHogServerProvider({
  apiKey: 'your-api-key',
  host: 'https://posthog.yourcompany.com'
})
```

## Type Safety

All PostHog configuration options are fully typed using TypeScript. Import the types if needed:

```typescript
import type { PostHogConfig } from 'posthog-js';        // For client
import type { PostHogOptions } from 'posthog-node';     // For server
```

## Resources

- [PostHog Documentation](https://posthog.com/docs)
- [PostHog JavaScript SDK](https://posthog.com/docs/libraries/js)
- [PostHog Node.js SDK](https://posthog.com/docs/libraries/node)
- [PostHog API Reference](https://posthog.com/docs/api)
