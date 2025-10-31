# Bento Provider

Bento is an email marketing and automation platform. This library provides both client-side (browser) and server-side (Node.js) providers for Bento.

## Installation

```bash
# Install the analytics library
pnpm install @stacksee/analytics

# For server-side usage, also install the Bento SDK
pnpm install @bentonow/bento-node-sdk
```

Note: The client-side provider loads Bento's script automatically from their CDN, so no additional package installation is needed for browser usage.

## Client-Side Usage

The Bento client provider automatically loads the Bento tracking script and provides a typed interface for tracking events.

### Basic Setup

```typescript
import { createClientAnalytics } from '@stacksee/analytics/client';
import { BentoClientProvider } from '@stacksee/analytics/providers/client';

const analytics = createClientAnalytics({
  providers: [
    new BentoClientProvider({
      siteUuid: 'your-bento-site-uuid',
      debug: false,   // optional
      enabled: true   // optional
    })
  ]
});

await analytics.initialize();
```

### Configuration Options

```typescript
interface BentoClientConfig {
  siteUuid: string;     // Required: Your Bento Site UUID from Account Settings
  debug?: boolean;      // Optional: Enable debug logging (default: false)
  enabled?: boolean;    // Optional: Enable/disable provider (default: true)
}
```

### Getting Your Site UUID

1. Log in to your Bento account
2. Go to **Account Settings**
3. Find your **Site UUID** in the tracking section

### Identifying Users

```typescript
// Identify with email (recommended)
analytics.identify('user@example.com', {
  email: 'user@example.com',
  name: 'John Doe',
  plan: 'pro',
  company: 'Acme Corp'
});

// The email is automatically extracted and sent to Bento
// Additional fields are stored as custom fields
```

### Tracking Events

```typescript
// Track custom events
analytics.track('button_clicked', {
  buttonId: 'signup-cta',
  page: '/landing'
});

// Track page views
analytics.pageView({
  category: 'product',
  productId: 'prod-123'
});
```

## Server-Side Usage

The Bento server provider uses the `@bentonow/bento-node-sdk` for Node.js environments.

### Basic Setup

```typescript
import { createServerAnalytics } from '@stacksee/analytics/server';
import { BentoServerProvider } from '@stacksee/analytics/providers/server';

const analytics = createServerAnalytics({
  providers: [
    new BentoServerProvider({
      siteUuid: process.env.BENTO_SITE_UUID,
      authentication: {
        publishableKey: process.env.BENTO_PUBLISHABLE_KEY,
        secretKey: process.env.BENTO_SECRET_KEY
      }
    })
  ]
});

analytics.initialize();

// Track events with user context
await analytics.track('purchase_completed', {
  orderId: 'order-123',
  amount: 99.99
}, {
  userId: 'user-456',
  user: {
    email: 'user@example.com',
    traits: {
      plan: 'pro',
      company: 'Acme Corp'
    }
  }
});

// Important: Always shutdown to flush events
await analytics.shutdown();
```

### Configuration Options

The configuration extends Bento's SDK options with proper typing:

```typescript
interface BentoServerConfig {
  // Required: Site configuration
  siteUuid: string;

  // Required: Authentication credentials
  authentication: {
    publishableKey: string;  // Your Bento Publishable Key
    secretKey: string;       // Your Bento Secret Key
  };

  // Optional: Client configuration
  clientOptions?: {
    baseUrl?: string;        // Custom Bento API URL (for self-hosted)
  };

  // Optional: Error handling
  logErrors?: boolean;       // Log SDK errors (default: false)

  // Optional: Analytics library options
  debug?: boolean;           // Enable debug logging (default: false)
  enabled?: boolean;         // Enable/disable provider (default: true)
}
```

### Getting Your API Keys

1. Log in to your Bento account
2. Go to **Team Settings**
3. Navigate to **Your Private API Keys**
4. Copy your **Site UUID**, **Publishable Key**, and **Secret Key**

### Example with Environment Variables

```typescript
// .env file
BENTO_SITE_UUID=your-site-uuid
BENTO_PUBLISHABLE_KEY=your-publishable-key
BENTO_SECRET_KEY=your-secret-key

// Server code
new BentoServerProvider({
  siteUuid: process.env.BENTO_SITE_UUID!,
  authentication: {
    publishableKey: process.env.BENTO_PUBLISHABLE_KEY!,
    secretKey: process.env.BENTO_SECRET_KEY!
  },
  debug: process.env.NODE_ENV === 'development'
})
```

## User Context

Bento requires an email address for tracking events. The library handles this automatically:

### Client-Side

```typescript
// Identify user with email
analytics.identify('user-123', {
  email: 'user@example.com',
  name: 'John Doe'
});

// All subsequent events automatically include user context
analytics.track('feature_used', {
  featureName: 'export'
});
```

### Server-Side

```typescript
// Pass user email with each event
await analytics.track('api_request', {
  endpoint: '/users'
}, {
  user: {
    email: 'user@example.com',
    traits: {
      plan: 'pro'
    }
  }
});

// The library automatically extracts the email and sends it to Bento
```

## Event Types

Bento supports custom events with arbitrary properties:

```typescript
// Track custom events with details
await analytics.track('video_watched', {
  videoId: 'intro-tutorial',
  duration: 120,
  completionRate: 0.85
}, {
  user: {
    email: 'user@example.com'
  }
});

// Track page views
analytics.pageView({
  path: '/products/widget',
  title: 'Product Widget'
});
```

## Tags and Custom Fields

While the analytics library provides a generic interface, you can add tags and custom fields through Bento's identify method:

```typescript
// Add custom fields when identifying
analytics.identify('user@example.com', {
  email: 'user@example.com',
  name: 'John Doe',
  plan: 'pro',               // Custom field
  company: 'Acme Corp',      // Custom field
  signupDate: '2024-01-15'   // Custom field
});

// These fields are automatically stored in Bento
```

## Serverless Environments

Always call `shutdown()` in serverless environments to ensure events are sent:

```typescript
// Vercel Functions
import { waitUntil } from '@vercel/functions';

export default async function handler(req, res) {
  const analytics = createServerAnalytics({
    providers: [
      new BentoServerProvider({
        siteUuid: process.env.BENTO_SITE_UUID,
        authentication: {
          publishableKey: process.env.BENTO_PUBLISHABLE_KEY,
          secretKey: process.env.BENTO_SECRET_KEY
        }
      })
    ]
  });

  analytics.initialize();

  waitUntil(
    analytics.track('api_request', {
      endpoint: req.url
    }, {
      user: {
        email: req.user?.email
      }
    }).then(() => analytics.shutdown())
  );

  res.status(200).json({ success: true });
}
```

## Event Batching

The Bento SDK uses the batch API, which means:

- Events may take **1-3 minutes** to appear in Bento
- This is normal behavior and allows for efficient event processing
- Critical events that trigger automations should be tracked with this latency in mind

## Type Safety

All Bento configuration options are fully typed. Import the types if needed:

```typescript
import type { BentoClientConfig } from '@stacksee/analytics/providers/client';
import type { BentoServerConfig, BentoAnalyticsOptions } from '@stacksee/analytics/providers/server';
```

## Advanced Usage

### Accessing User Information (Client-Side)

The Bento SDK provides utility methods that can be accessed if needed:

```typescript
// Note: This requires direct access to the Bento SDK
// The analytics library abstracts this, but you can access it if needed
const email = window.bento?.getEmail();
const name = window.bento?.getName();
```

### Custom Event Prefix (Server-Side)

The server provider automatically prefixes custom events with `$` to match Bento's convention:

```typescript
// You track: 'purchase_completed'
// Bento receives: '$purchase_completed'
```

This is handled automatically by the provider.

## Limitations

### Client-Side
- Requires browser environment (no SSR)
- Script loads from Bento's CDN
- Automatically tracks initial page view

### Server-Side
- Requires `@bentonow/bento-node-sdk` package
- Events may take 1-3 minutes to appear (batch API)
- Requires email address for all events

## Resources

- [Bento Documentation](https://docs.bentonow.com/)
- [Bento JavaScript SDK](https://docs.bentonow.com/examples/javascript)
- [Bento Node.js SDK](https://docs.bentonow.com/examples/nodejs)
- [Bento SDK on GitHub](https://github.com/bentonow/bento-node-sdk)
