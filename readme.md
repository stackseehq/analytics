# @stacksee/analytics

A highly typed, provider-agnostic analytics library for TypeScript applications. Works seamlessly on both client and server sides with full type safety for your custom events.

## Features

- 🎯 **Type-safe events**: Define your own strongly typed events with full IntelliSense support
- 🔌 **Plugin architecture**: Easily add analytics providers by passing them as plugins
- 🌐 **Universal**: Same API works on both client (browser) and server (Node.js)
- 📦 **Lightweight**: Zero dependencies on the core library
- 🏗️ **Framework agnostic**: Use with any JavaScript framework
- 🌎 **Edge ready**: The server client is compatible with edge runtime (e.g. Cloudflare Workers)
- 🔧 **Extensible**: Simple interface to add new providers

## Installation

```bash
pnpm install @stacksee/analytics

# For PostHog support
pnpm install posthog-js posthog-node
```

## Quick Start

### 1. Define Your Events

Create strongly typed events specific to your application:

```typescript
import { CreateEventDefinition, EventCollection } from '@stacksee/analytics';

// Define your event types
export const AppEvents = {
  userSignedUp: {
    name: 'user_signed_up',
    category: 'user',
    properties: {} as {
      userId: string;
      email: string;
      plan: 'free' | 'pro' | 'enterprise';
      referralSource?: string;
    }
  },

  featureUsed: {
    name: 'feature_used',
    category: 'engagement',
    properties: {} as {
      featureName: string;
      userId: string;
      duration?: number;
    }
  }
} as const satisfies EventCollection<Record<string, CreateEventDefinition<string>>>;

// Extract types for use in your app
export type AppEventName = keyof typeof AppEvents;
export type AppEventProperties<T extends AppEventName> = typeof AppEvents[T]['properties'];
```

Tip: If you have a lot of events, you can also divide your events into multiple files, then export them as a single object.

### 2. Client-Side Usage

```typescript
import { createClientAnalytics } from '@stacksee/analytics/client';
import { PostHogClientProvider } from '@stacksee/analytics/providers/posthog';
import { AppEvents } from './events';

// Initialize analytics with providers as plugins
const analytics = createClientAnalytics({
  providers: [
    new PostHogClientProvider({
      apiKey: 'your-posthog-api-key',
      host: 'https://app.posthog.com' // optional
    }),
    // Add more providers here as needed
  ],
  debug: true,
  enabled: true
});

// Track events with full type safety
analytics.track(AppEvents.pageViewed.name, {
  path: '/dashboard',
  title: 'Dashboard',
  referrer: document.referrer
});

analytics.track(AppEvents.userSignedUp.name, {
  userId: 'user-123',
  email: 'user@example.com',
  plan: 'pro',
  referralSource: 'google'
});

// Identify users
analytics.identify('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
  plan: 'pro'
});
```

### 3. Server-Side Usage

```typescript
import { createServerAnalytics } from '@stacksee/analytics/server';
import { PostHogServerProvider } from '@stacksee/analytics/providers/posthog';
import { AppEvents } from './events';

// Create analytics instance with providers as plugins
const analytics = createServerAnalytics({
  providers: [
    new PostHogServerProvider({
      apiKey: process.env.POSTHOG_API_KEY,
      host: process.env.POSTHOG_HOST
    }),
    // Add more providers here as needed
  ],
  debug: process.env.NODE_ENV === 'development',
  enabled: true
});

// Track events - now returns a Promise
await analytics.track(AppEvents.featureUsed.name, {
  featureName: 'export-data',
  userId: 'user-123',
  duration: 1500
}, {
  userId: 'user-123',
  context: {
    page: {
      path: '/api/export',
    }
  }
});

// Important: Always call shutdown when done, some providers such as Posthog require flushing events.
await analytics.shutdown();
```

### Async Tracking: When to await vs fire-and-forget

The `track()` method now returns a `Promise<void>`, giving you control over how to handle event tracking:

#### Fire-and-forget (Client-side typical usage)
```typescript
// Don't await - let events send in the background
analytics.track('button_clicked', {
  buttonId: 'checkout',
  label: 'Proceed to Checkout'
});

// User interaction continues immediately
```

#### Await for critical events (Server-side typical usage)
```typescript
// In serverless/edge functions, await to ensure events are sent
export async function handler(req, res) {
  try {
    // Process the request...

    // Await critical tracking to ensure it completes
    await analytics.track('payment_processed', {
      amount: 99.99,
      currency: 'USD',
      userId: req.userId
    });

    // Ensure all events are flushed before function ends
    await analytics.shutdown();

    return res.json({ success: true });
  } catch (error) {
    // Handle errors appropriately
    console.error('Failed to track event:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

#### Error handling
```typescript
// The track method catches provider errors internally and logs them
// It won't throw even if a provider fails, ensuring one provider's failure
// doesn't affect others

// If you need to know about failures, check your logs
await analytics.track('important_event', { data: 'value' });
// Even if one provider fails, others will still receive the event
```

#### Best practices:
- **Client-side**: Usually fire-and-forget for better UX
- **Server-side**: Usually await, especially in serverless environments
- **Critical events**: Always await (e.g., payments, conversions)
- **High-volume events**: Fire-and-forget to avoid blocking

### A complete example

Here's a complete example using Svelte 5 that demonstrates both client and server-side analytics for a waitlist signup:

```typescript
// src/lib/config/analytics.ts
import { createClientAnalytics } from '@stacksee/analytics/client';
import { PostHogClientProvider } from '@stacksee/analytics/providers/posthog';
import { PUBLIC_POSTHOG_API_KEY, PUBLIC_POSTHOG_HOST } from '$env/static/public';

// Define your events for the waitlist
export const AppEvents = {
  waitlistJoined: {
    name: 'waitlist_joined',
    category: 'user',
    properties: {} as {
      email: string;
      source: string; // e.g., 'homepage_banner', 'product_page_modal'
    }
  },
  waitlistApproved: {
    name: 'waitlist_approved',
    category: 'user',
    properties: {} as {
      userId: string; // This could be the email or a generated ID
      email: string;
    }
  }
} as const;

// Client-side analytics instance
export const clientAnalytics = createClientAnalytics({
  providers: [
    new PostHogClientProvider({
      apiKey: import.meta.env.VITE_POSTHOG_KEY, // Ensure VITE_POSTHOG_KEY is in your .env file
      host: 'https://app.posthog.com'
    })
  ],
  debug: import.meta.env.DEV
});
```

```typescript
// src/lib/server/analytics.ts
import { createServerAnalytics } from '@stacksee/analytics/server';
import { PostHogServerProvider } from '@stacksee/analytics/providers/posthog';
import { AppEvents } from '$lib/config/analytics'; // Import AppEvents
import { PUBLIC_POSTHOG_API_KEY, PUBLIC_POSTHOG_HOST } from '$env/static/public';

export const serverAnalytics = createServerAnalytics({
  providers: [
    new PostHogServerProvider({
      apiKey: PUBLIC_POSTHOG_API_KEY,
      host: PUBLIC_POSTHOG_HOST
    })
  ],
  debug: process.env.NODE_ENV === 'development'
});
```

```svelte
<!-- src/routes/join-waitlist/+page.svelte -->
<script lang="ts">
  import { clientAnalytics, AppEvents } from '$lib/config/analytics';

  let email = $state('');
  let loading = $state(false);
  let message = $state('');

  async function handleWaitlistSubmit(event: Event) {
    event.preventDefault();
    loading = true;
    message = '';

    try {
      // Track waitlist joined event on the client
      clientAnalytics.track(AppEvents.waitlistJoined.name, {
        email,
        source: 'waitlist_page_form'
      });

      // Submit email to the server
      const response = await fetch('/api/join-waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to join waitlist');
      }

      message = 'Successfully joined the waitlist! We will notify you once you are approved.';
    } catch (error) {
      console.error('Waitlist submission failed:', error);
      message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    } finally {
      loading = false;
    }
  }
</script>

<h2>Join Our Waitlist</h2>
<form onsubmit={handleWaitlistSubmit}>
  <label>
    Email:
    <input
      type="email"
      bind:value={email}
      placeholder="you@example.com"
      required
      disabled={loading}
    />
  </label>
  <button type="submit" disabled={loading}>
    {loading ? 'Joining...' : 'Join Waitlist'}
  </button>
</form>

{#if message}
  <p>{message}</p>
{/if}
```

```typescript
// src/routes/api/join-waitlist/+server.ts
import { serverAnalytics } from '$lib/server/analytics';
import { AppEvents } from '$lib/config/analytics'; // Import AppEvents
import { json, type RequestHandler } from '@sveltejs/kit';

async function approveUserForWaitlist(email: string): Promise<{ userId: string }> {
  console.log(`Processing waitlist application for: ${email}`);

  const userId = `user_${Date.now()}_${email.split('@')[0]}`;

  return { userId };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const email = body.email;

    if (!email || typeof email !== 'string') {
      return json({ success: false, message: 'Email is required' }, { status: 400 });
    }

    const { userId } = await approveUserForWaitlist(email);

    serverAnalytics.track(AppEvents.waitlistApproved.name, {
      userId,
      email
    }, {
      userId,
      context: {
        page: {
          path: '/api/join-waitlist'
        },
        ip: request.headers.get('x-forwarded-for') || undefined
      }
    });

    // Important: Call shutdown if your application instance is short-lived. (e.g. serverless function)
    // For long-running servers, you might call this on server shutdown.
    await serverAnalytics.shutdown();

    return json({ success: true, userId, message: 'Successfully joined and approved for waitlist.' });
  } catch (error) {
    console.error('Failed to process waitlist application:', error);
    // In production, be careful about leaking error details
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return json({ success: false, message: errorMessage }, { status: 500 });
  }
  // Note: serverAnalytics.shutdown() should ideally be called when the server itself is shutting down,
  // not after every request in a typical web server setup, unless the provider requires it for batching.
  // For this example, PostHogServerProvider benefits from shutdown to flush events,
  // so if this were, for example, a serverless function processing one event, calling shutdown would be appropriate.
  // If it's a long-running server, manage shutdown centrally.
};
```

## Advanced Usage

### Creating a Typed Analytics Service

For better type safety across your application, create a typed wrapper:

```typescript
import {
  BrowserAnalytics,
  ServerAnalytics,
  ExtractEventNames,
  ExtractEventPropertiesFromCollection
} from '@stacksee/analytics';
import { AppEvents } from './events';

// Type aliases for your app
type AppEventName = ExtractEventNames<typeof AppEvents>;
type AppEventProps<T extends AppEventName> = ExtractEventPropertiesFromCollection<typeof AppEvents, T>;

// Client-side typed wrapper
export class AppAnalytics {
  constructor(private analytics: BrowserAnalytics) {}

  track<T extends AppEventName>(
    eventName: T,
    properties: AppEventProps<T>
    ): Promise<void> {
    return this.analytics.track(eventName, properties);
  }

  // ... other methods
}

// Server-side typed wrapper
export class ServerAppAnalytics {
  constructor(private analytics: ServerAnalytics) {}

  track<T extends AppEventName>(
    eventName: T,
    properties: AppEventProps<T>,
    options?: { userId?: string; sessionId?: string }
  ): Promise<void> {
    return this.analytics.track(eventName, properties, options);
  }

  // ... other methods
}
```

### Event Categories

Event categories help organize your analytics data. The SDK provides predefined categories with TypeScript autocomplete:

- `product` - Product-related events (views, purchases, etc.)
- `user` - User lifecycle events (signup, login, profile updates)
- `navigation` - Page views and navigation events
- `conversion` - Conversion and goal completion events
- `engagement` - Feature usage and interaction events
- `error` - Error tracking events
- `performance` - Performance monitoring events

You can also use **custom categories** for your specific needs:

```typescript
export const AppEvents = {
  aiResponse: {
    name: 'ai_response_generated',
    category: 'ai', // Custom category
    properties: {} as {
      model: string;
      responseTime: number;
      tokensUsed: number;
    }
  },

  customWorkflow: {
    name: 'workflow_completed',
    category: 'workflow', // Another custom category
    properties: {} as {
      workflowId: string;
      duration: number;
      steps: number;
    }
  }
} as const satisfies EventCollection<Record<string, CreateEventDefinition<string>>>;
```

### Adding Custom Providers

Implement the `AnalyticsProvider` interface to add support for other analytics services:

```typescript
import { BaseAnalyticsProvider, BaseEvent, EventContext } from '@stacksee/analytics';

export class GoogleAnalyticsProvider extends BaseAnalyticsProvider {
  name = 'GoogleAnalytics';
  private measurementId: string;

  constructor(config: { measurementId: string; debug?: boolean; enabled?: boolean }) {
    super({ debug: config.debug, enabled: config.enabled });
    this.measurementId = config.measurementId;
  }

  async initialize(): Promise<void> {
    // Initialize GA
  }

  track(event: BaseEvent, context?: EventContext): void {
    // Send event to GA
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    // Set user properties in GA
  }

  // ... implement other required methods
}
```

Then use it as a plugin in your configuration:

```typescript
const analytics = await createClientAnalytics({
  providers: [
    new PostHogClientProvider({ apiKey: 'xxx' }),
    new GoogleAnalyticsProvider({ measurementId: 'xxx' })
  ]
});
```

### Client-Only and Server-Only Providers

Some analytics libraries are designed to work only in specific environments. For example:
- **Client-only**: Google Analytics (gtag.js), Hotjar, FullStory
- **Server-only**: Some enterprise analytics APIs that require secret keys
- **Universal**: PostHog, Segment (have separate client/server SDKs)

The library handles this by having separate provider implementations for client and server environments:

```typescript
// Client-side provider for a client-only analytics service
import { BaseAnalyticsProvider, BaseEvent, EventContext } from '@stacksee/analytics';

export class MixpanelClientProvider extends BaseAnalyticsProvider {
  name = 'Mixpanel-Client';

  constructor(config: { projectToken: string }) {
    super();
    // Initialize Mixpanel browser SDK
  }

  // ... implement required methods
}

// Server-side provider for a server-only analytics service
export class MixpanelServerProvider extends BaseAnalyticsProvider {
  name = 'Mixpanel-Server';

  constructor(config: { projectToken: string; apiSecret: string }) {
    super();
    // Initialize Mixpanel server SDK with secret
  }

  // ... implement required methods
}
```

Then use the appropriate provider based on your environment:

```typescript
// Client-side usage
import { createClientAnalytics } from '@stacksee/analytics/client';
import { MixpanelClientProvider } from './providers/mixpanel-client';

const clientAnalytics = createClientAnalytics({
  providers: [
    new MixpanelClientProvider({ projectToken: 'xxx' })
  ]
});

// Server-side usage
import { createServerAnalytics } from '@stacksee/analytics/server';
import { MixpanelServerProvider } from './providers/mixpanel-server';

const serverAnalytics = createServerAnalytics({
  providers: [
    new MixpanelServerProvider({
      projectToken: 'xxx',
      apiSecret: 'secret-xxx' // Server-only configuration
    })
  ]
});
```

**Important notes:**
- Client providers should only use browser-compatible APIs
- Server providers can use Node.js-specific features and secret credentials
- The provider interface is the same, ensuring consistent usage patterns
- Import paths are separate (`/client` vs `/server`) to prevent accidental usage in wrong environments

### Using Multiple Providers

The plugin architecture makes it easy to send events to multiple analytics services simultaneously:

```typescript
import { createClientAnalytics } from '@stacksee/analytics/client';
import { PostHogClientProvider } from '@stacksee/analytics/providers/posthog';
// Import your custom providers
import { GoogleAnalyticsProvider } from './providers/google-analytics';
import { MixpanelProvider } from './providers/mixpanel';

const analytics = createClientAnalytics({
  providers: [
    // PostHog for product analytics
    new PostHogClientProvider({
      apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      host: 'https://app.posthog.com'
    }),

    // Google Analytics for marketing insights
    new GoogleAnalyticsProvider({
      measurementId: process.env.NEXT_PUBLIC_GA_ID
    }),

    // Mixpanel for detailed user journey analysis
    new MixpanelProvider({
      projectToken: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN
    })
  ],
  debug: process.env.NODE_ENV === 'development',
  enabled: true
});

// All providers will receive this event
analytics.track('user_signed_up', {
  userId: 'user-123',
  plan: 'pro'
});
```

## Server Deployments and waitUntil

When deploying your application to serverless environments, it's important to handle analytics events properly to ensure they are sent before the function terminates. Different platforms provide their own mechanisms for this:

### Vercel Functions

Vercel provides a `waitUntil` API that allows you to continue processing after the response has been sent:

```typescript
import { waitUntil } from '@vercel/functions';

export default async function handler(req, res) {
  const analytics = createServerAnalytics({
    providers: [new PostHogServerProvider({ apiKey: process.env.POSTHOG_API_KEY })]
  });

  // Track the event - await to ensure it's queued
  await analytics.track('api_request', {
    endpoint: '/api/users',
    method: 'POST',
    statusCode: 200,
    responseTime: 150
  });

  // Use waitUntil to ensure events are sent
  waitUntil(analytics.shutdown());

  res.status(200).json({ success: true });
}
```

### Cloudflare Workers

Cloudflare Workers provides a `waitUntil` method on the execution context:

```typescript
export default {
  async fetch(request, env, ctx) {
    const analytics = createServerAnalytics({
      providers: [new PostHogServerProvider({ apiKey: env.POSTHOG_API_KEY })]
    });

    // Track the event - await to ensure it's queued
    await analytics.track('worker_execution', {
      url: request.url,
      method: request.method,
      cacheStatus: 'MISS',
      executionTime: 45
    });

    // Use ctx.waitUntil to ensure events are sent
    ctx.waitUntil(analytics.shutdown());

    return new Response('OK');
  }
};
```

### Netlify Functions

Netlify Functions also support `waitUntil` through their context object:

```typescript
export async function handler(event, context) {
  const analytics = createServerAnalytics({
    providers: [new PostHogServerProvider({ apiKey: process.env.POSTHOG_API_KEY })]
  });

  // Track the event - await to ensure it's queued
  await analytics.track('function_invocation', {
    path: event.path,
    httpMethod: event.httpMethod,
    queryStringParameters: event.queryStringParameters,
    executionTime: 120
  });

  // Use context.waitUntil to ensure events are sent
  context.waitUntil(analytics.shutdown());

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}
```

**Important Notes:**
1. Always call `analytics.shutdown()` within `waitUntil` to ensure events are sent
2. The `waitUntil` API is platform-specific, so make sure to use the correct import/usage for your deployment platform
3. For long-running servers (not serverless), you should call `shutdown()` when the server itself is shutting down
4. Some providers may batch events, so `shutdown()` ensures all pending events are sent

## API Reference

### Client API

#### `createClientAnalytics(config)`
Initialize analytics for browser environment.

- `config.providers` - Array of analytics provider instances
- `config.debug` - Enable debug logging
- `config.enabled` - Enable/disable analytics

#### `BrowserAnalytics`
- `track(eventName, properties): Promise<void>` - Track an event (returns a promise)
- `identify(userId, traits)` - Identify a user
- `page(properties)` - Track a page view
- `reset()` - Reset user session
- `updateContext(context)` - Update event context

### Server API

#### `createServerAnalytics(config)`
Create analytics instance for server environment.

- `config.providers` - Array of analytics provider instances
- `config.debug` - Enable debug logging
- `config.enabled` - Enable/disable analytics

#### `ServerAnalytics`
- `track(eventName, properties, options): Promise<void>` - Track an event with optional context (returns a promise)
- `identify(userId, traits)` - Identify a user
- `page(properties, options)` - Track a page view
- `shutdown()` - Flush pending events and cleanup

### Type Helpers

- `CreateEventDefinition<TName, TProperties>` - Define a single event
- `EventCollection<T>` - Define a collection of events
- `ExtractEventNames<T>` - Extract event names from a collection
- `ExtractEventPropertiesFromCollection<T, TEventName>` - Extract properties for a specific event

## Best Practices

1. **Define events in a central location** - Keep all event definitions in one file for consistency
2. **Use const assertions** - Use `as const` for better type inference
3. **Initialize early** - Initialize analytics as early as possible in your app lifecycle
4. **Handle errors gracefully** - Analytics should never break your app
5. **Respect privacy** - Implement user consent and opt-out mechanisms
6. **Test your events** - Verify events are tracked correctly in development
7. **Document events** - Add comments to explain when each event should be fired
8. **Create provider instances once** - Reuse provider instances across your app

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT