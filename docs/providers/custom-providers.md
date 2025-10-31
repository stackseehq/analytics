# Creating Custom Providers

This guide explains how to create custom analytics providers for the `@stacksee/analytics` library.

## Table of Contents

- [Overview](#overview)
- [Provider Interface](#provider-interface)
- [Basic Provider Example](#basic-provider-example)
- [Client-Side Provider](#client-side-provider)
- [Server-Side Provider](#server-side-provider)
- [Using User Context](#using-user-context)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Testing Your Provider](#testing-your-provider)

## Overview

The library uses a plugin architecture where each analytics service is implemented as a provider. All providers must implement the `AnalyticsProvider` interface, which the `BaseAnalyticsProvider` abstract class makes easier.

## Provider Interface

Every provider must implement these methods:

```typescript
interface AnalyticsProvider {
  name: string;                                    // Provider name for logging
  initialize(): Promise<void> | void;              // Initialize the provider
  identify(userId: string, traits?: Record<string, unknown>): Promise<void> | void;
  track(event: BaseEvent, context?: EventContext): Promise<void> | void;
  pageView(properties?: Record<string, unknown>, context?: EventContext): Promise<void> | void;
  pageLeave?(properties?: Record<string, unknown>, context?: EventContext): Promise<void> | void;
  reset(): Promise<void> | void;                   // Reset user session
  shutdown?(): Promise<void>;                      // Cleanup (server-side only)
}
```

## Basic Provider Example

Here's a minimal provider implementation:

```typescript
import { BaseAnalyticsProvider, BaseEvent, EventContext } from '@stacksee/analytics';

export class CustomProvider extends BaseAnalyticsProvider {
  name = 'CustomProvider';
  private apiKey: string;
  private client?: any;

  constructor(config: { apiKey: string; debug?: boolean; enabled?: boolean }) {
    super({ debug: config.debug, enabled: config.enabled });
    this.apiKey = config.apiKey;
  }

  async initialize(): Promise<void> {
    if (!this.isEnabled()) return;

    // Initialize your analytics SDK
    this.client = await initializeSDK(this.apiKey);

    this.log('Initialized successfully');
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    if (!this.isEnabled() || !this.client) return;

    this.client.identify(userId, traits);
    this.log('Identified user', { userId, traits });
  }

  track(event: BaseEvent, context?: EventContext): void {
    if (!this.isEnabled() || !this.client) return;

    this.client.track(event.action, {
      ...event.properties,
      userId: event.userId,
      timestamp: event.timestamp
    });

    this.log('Tracked event', { event, context });
  }

  pageView(properties?: Record<string, unknown>, context?: EventContext): void {
    if (!this.isEnabled() || !this.client) return;

    this.client.page(properties);
    this.log('Tracked page view', { properties, context });
  }

  reset(): void {
    if (!this.isEnabled() || !this.client) return;

    this.client.reset();
    this.log('Reset user session');
  }
}
```

## Client-Side Provider

Client-side providers should only use browser-compatible APIs:

```typescript
import { BaseAnalyticsProvider, BaseEvent, EventContext } from '@stacksee/analytics';
import { isBrowser } from '@stacksee/analytics/utils';

export class GoogleAnalyticsProvider extends BaseAnalyticsProvider {
  name = 'GoogleAnalytics';
  private measurementId: string;
  private initialized = false;

  constructor(config: { measurementId: string; debug?: boolean; enabled?: boolean }) {
    super({ debug: config.debug, enabled: config.enabled });
    this.measurementId = config.measurementId;
  }

  async initialize(): Promise<void> {
    if (!this.isEnabled()) return;
    if (this.initialized) return;

    if (!isBrowser()) {
      this.log('Skipping initialization - not in browser environment');
      return;
    }

    // Load Google Analytics script
    await this.loadGtagScript();

    // Initialize gtag
    window.gtag('config', this.measurementId);

    this.initialized = true;
    this.log('Initialized successfully');
  }

  private async loadGtagScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Analytics'));
      document.head.appendChild(script);

      // Initialize gtag function
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
    });
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    if (!this.isEnabled() || !this.initialized || !isBrowser()) return;

    window.gtag('set', 'user_properties', {
      user_id: userId,
      ...traits
    });

    this.log('Identified user', { userId, traits });
  }

  track(event: BaseEvent, context?: EventContext): void {
    if (!this.isEnabled() || !this.initialized || !isBrowser()) return;

    window.gtag('event', event.action, {
      ...event.properties,
      event_category: event.category,
      user_id: event.userId
    });

    this.log('Tracked event', { event });
  }

  pageView(properties?: Record<string, unknown>, context?: EventContext): void {
    if (!this.isEnabled() || !this.initialized || !isBrowser()) return;

    window.gtag('event', 'page_view', {
      page_path: context?.page?.path || window.location.pathname,
      page_title: context?.page?.title || document.title,
      ...properties
    });

    this.log('Tracked page view', { properties });
  }

  reset(): void {
    // GA doesn't have a reset method, but you could clear user properties
    if (!this.isEnabled() || !this.initialized || !isBrowser()) return;

    window.gtag('set', 'user_properties', null);
    this.log('Reset user session');
  }
}

// TypeScript declarations
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}
```

## Server-Side Provider

Server-side providers can use Node.js-specific features and should support the `shutdown()` method:

```typescript
import { BaseAnalyticsProvider, BaseEvent, EventContext } from '@stacksee/analytics';

export class MixpanelServerProvider extends BaseAnalyticsProvider {
  name = 'Mixpanel-Server';
  private client?: any;
  private config: { projectToken: string; apiSecret: string };

  constructor(config: {
    projectToken: string;
    apiSecret: string;
    debug?: boolean;
    enabled?: boolean;
  }) {
    super({ debug: config.debug, enabled: config.enabled });
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.isEnabled()) return;

    // Dynamically import the SDK to avoid bundling issues
    const Mixpanel = await import('mixpanel');

    this.client = Mixpanel.init(this.config.projectToken, {
      secret: this.config.apiSecret
    });

    this.log('Initialized successfully');
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    if (!this.isEnabled() || !this.client) return;

    this.client.people.set(userId, traits || {});
    this.log('Identified user', { userId, traits });
  }

  async track(event: BaseEvent, context?: EventContext): Promise<void> {
    if (!this.isEnabled() || !this.client) return;

    // Get user email from context if available
    const distinctId = context?.user?.userId ||
                       context?.user?.email ||
                       event.userId ||
                       'anonymous';

    this.client.track(event.action, {
      distinct_id: distinctId,
      ...event.properties,
      $email: context?.user?.email,
      ...context?.user?.traits
    });

    this.log('Tracked event', { event, context });
  }

  pageView(properties?: Record<string, unknown>, context?: EventContext): void {
    if (!this.isEnabled() || !this.client) return;

    const distinctId = context?.user?.userId || 'anonymous';

    this.client.track('page_view', {
      distinct_id: distinctId,
      page_path: context?.page?.path,
      page_title: context?.page?.title,
      ...properties
    });

    this.log('Tracked page view', { properties });
  }

  async reset(): Promise<void> {
    // Server-side reset typically just flushes pending events
    await this.shutdown();
  }

  async shutdown(): Promise<void> {
    if (!this.client) return;

    // Flush any pending events
    await new Promise<void>((resolve) => {
      this.client.flush(() => {
        this.log('Flushed pending events');
        resolve();
      });
    });
  }
}
```

## Using User Context

The library automatically includes user context (email, traits) from `identify()` calls. Your provider should extract this from the `EventContext`:

```typescript
track(event: BaseEvent, context?: EventContext): void {
  // Access user context
  const email = context?.user?.email;
  const userId = context?.user?.userId;
  const traits = context?.user?.traits;

  // Some providers require email
  if (!email) {
    this.log('Skipping event - email required');
    return;
  }

  // Use the user context in your tracking
  this.client.track({
    email,
    userId,
    eventName: event.action,
    properties: {
      ...event.properties,
      ...traits  // Include user traits if relevant
    }
  });
}
```

## Error Handling

The library catches errors from providers to prevent one provider's failure from affecting others. However, you should still handle errors gracefully:

```typescript
async track(event: BaseEvent, context?: EventContext): Promise<void> {
  if (!this.isEnabled() || !this.client) return;

  try {
    await this.client.track(event.action, event.properties);
    this.log('Tracked event', { event });
  } catch (error) {
    // Log the error but don't throw
    console.error(`[${this.name}] Failed to track event:`, error);

    // Optionally: Report to error tracking service
    // this.reportError(error);
  }
}
```

## Best Practices

### 1. Use the BaseAnalyticsProvider

Extend `BaseAnalyticsProvider` to get built-in debug logging and enabled/disabled functionality:

```typescript
export class MyProvider extends BaseAnalyticsProvider {
  constructor(config: MyConfig) {
    super({ debug: config.debug, enabled: config.enabled });
  }

  track(event: BaseEvent): void {
    if (!this.isEnabled()) return;  // Built-in check

    // Your tracking logic

    this.log('Tracked event', event);  // Built-in debug logging
  }
}
```

### 2. Handle Initialization State

Always check if the provider is initialized before using it:

```typescript
private initialized = false;

async initialize(): Promise<void> {
  if (this.initialized) return;  // Prevent double initialization

  // Initialize SDK
  this.client = await initSDK();
  this.initialized = true;
}

track(event: BaseEvent): void {
  if (!this.initialized || !this.client) return;
  // Track event
}
```

### 3. Support Optional Dependencies

Use dynamic imports for optional SDK dependencies:

```typescript
async initialize(): Promise<void> {
  try {
    const { Analytics } = await import('some-analytics-sdk');
    this.client = new Analytics(this.config);
  } catch (error) {
    console.error('Failed to load SDK. Make sure it is installed:', error);
    throw error;
  }
}
```

### 4. Type Your Configuration

Export your configuration interface for better developer experience:

```typescript
export interface MyProviderConfig {
  apiKey: string;
  endpoint?: string;
  timeout?: number;
  debug?: boolean;
  enabled?: boolean;
}

export class MyProvider extends BaseAnalyticsProvider {
  constructor(config: MyProviderConfig) {
    super({ debug: config.debug, enabled: config.enabled });
  }
}
```

### 5. Document Your Provider

Add JSDoc comments to help users understand your provider:

```typescript
/**
 * Analytics provider for MyAnalytics service.
 *
 * @example
 * ```typescript
 * new MyProvider({
 *   apiKey: 'your-api-key',
 *   endpoint: 'https://api.myanalytics.com',
 *   debug: true
 * })
 * ```
 */
export class MyProvider extends BaseAnalyticsProvider {
  // ...
}
```

## Testing Your Provider

Create a simple test to verify your provider works:

```typescript
import { createClientAnalytics } from '@stacksee/analytics/client';
import { MyProvider } from './my-provider';

async function test() {
  const analytics = createClientAnalytics({
    providers: [
      new MyProvider({
        apiKey: 'test-key',
        debug: true
      })
    ]
  });

  await analytics.initialize();

  // Test identify
  analytics.identify('user-123', {
    email: 'test@example.com',
    name: 'Test User'
  });

  // Test track
  await analytics.track('test_event', {
    property: 'value'
  });

  // Test page view
  analytics.pageView({
    page: '/test'
  });

  console.log('All tests passed!');
}

test();
```

## Exporting Your Provider

If creating a provider for others to use, export it properly:

```typescript
// providers/my-provider/client.ts
export { MyClientProvider } from './client';
export type { MyClientConfig } from './client';

// providers/my-provider/server.ts
export { MyServerProvider } from './server';
export type { MyServerConfig } from './server';

// providers/my-provider/index.ts
export * from './client';
export * from './server';
```

## Resources

- [BaseAnalyticsProvider Source](../../src/providers/base.provider.ts)
- [PostHog Provider Example](../../src/providers/posthog/)
- [Bento Provider Example](../../src/providers/bento/)
- [TypeScript Types](../../src/core/events/types.ts)
