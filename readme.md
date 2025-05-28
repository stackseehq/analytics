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

// Track events
analytics.track(AppEvents.featureUsed.name, {
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

### A complete example

Here's a complete example using Svelte 5 that demonstrates both client and server-side analytics for a waitlist signup:

```typescript
// src/lib/config/analytics.ts
import { createClientAnalytics } from '@stacksee/analytics/client';
import { PostHogClientProvider } from '@stacksee/analytics/providers/posthog';

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
import { AppEvents } from '../config/analytics'; // Import AppEvents

// Server-side analytics instance
export const serverAnalytics = createServerAnalytics({
  providers: [
    new PostHogServerProvider({
      apiKey: process.env.POSTHOG_API_KEY, // Ensure POSTHOG_API_KEY is in your server environment
      host: process.env.POSTHOG_HOST
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
      // Optionally, redirect or clear form: email = '';
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

// Dummy function to simulate processing and approving a waitlist application
async function approveUserForWaitlist(email: string): Promise<{ userId: string }> {
  // In a real application, you would save the email to a database,
  // potentially queue it for review, or have some approval logic.
  // For this example, we'll assume immediate "approval" and generate a simple userId.
  console.log(`Processing waitlist application for: ${email}`);
  const userId = `user_${Date.now()}_${email.split('@')[0]}`; // Example userId
  return { userId };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const email = body.email;

    if (!email || typeof email !== 'string') {
      return json({ success: false, message: 'Email is required' }, { status: 400 });
    }

    // Simulate adding to waitlist and immediate approval
    const { userId } = await approveUserForWaitlist(email);

    // Track waitlist approved event on the server
    serverAnalytics.track(AppEvents.waitlistApproved.name, {
      userId,
      email
    }, {
      userId, // Pass userId for server-side context if needed
      context: {
        page: { // Example context
          path: '/api/join-waitlist'
        },
        ip: request.headers.get('x-forwarded-for') || undefined // Example of capturing IP
      }
    });

    // Important: Call shutdown if your application instance is short-lived.
    // For long-running servers, you might call this on server shutdown.
    // await serverAnalytics.shutdown(); // Commented out as this endpoint is typically part of a long-running server

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

This example shows:

1.  Setting up client and server analytics instances with specific event definitions for a waitlist.
2.  Using Svelte 5's `$state` for reactive UI elements.
3.  Client-side: A user submits their email to a form, triggering a `waitlist_joined` event.
4.  Server-side: The `/api/join-waitlist` endpoint receives the submission, simulates approval, and triggers a `waitlist_approved` event.
5.  Type-safe event tracking with distinct properties for each event.
6.  Basic error handling and user feedback on the client.
7.  Contextual information (like IP address) can be added to server-side events.
8.  Considerations for when to call `serverAnalytics.shutdown()`.

The flow demonstrates:
- User expresses interest by joining the waitlist on the client (tracked with `waitlist_joined`).
- The server processes this submission, "approves" the user, and tracks this approval (`waitlist_approved`).
- Clear separation of client-side interaction and server-side processing with corresponding analytics.

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
  ): void {
    this.analytics.track(eventName, properties);
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
  ): void {
    this.analytics.track(eventName, properties, options);
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

## API Reference

### Client API

#### `createClientAnalytics(config)`
Initialize analytics for browser environment.

- `config.providers` - Array of analytics provider instances
- `config.debug` - Enable debug logging
- `config.enabled` - Enable/disable analytics

#### `BrowserAnalytics`
- `track(eventName, properties)` - Track an event
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
- `track(eventName, properties, options)` - Track an event with optional context
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