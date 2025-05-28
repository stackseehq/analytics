# @stacksee/analytics

A highly typed, provider-agnostic analytics library for TypeScript applications. Works seamlessly on both client and server sides with full type safety for your custom events.

## Features

- 🎯 **Type-safe events**: Define your own strongly typed events with full IntelliSense support
- 🔌 **Plugin architecture**: Easily add analytics providers by passing them as plugins
- 🌐 **Universal**: Same API works on both client (browser) and server (Node.js)
- 📦 **Lightweight**: Zero dependencies on the core library
- 🏗️ **Framework agnostic**: Use with any JavaScript framework
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
const analytics = await createClientAnalytics({
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

### Using Multiple Providers

The plugin architecture makes it easy to send events to multiple analytics services simultaneously:

```typescript
import { createClientAnalytics } from '@stacksee/analytics/client';
import { PostHogClientProvider } from '@stacksee/analytics/providers/posthog';
// Import your custom providers
import { GoogleAnalyticsProvider } from './providers/google-analytics';
import { MixpanelProvider } from './providers/mixpanel';

const analytics = await createClientAnalytics({
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