# Pirsch Provider

Pirsch is a privacy-friendly, cookie-free web analytics platform. This library provides both client-side (browser) and server-side (Node.js) providers for Pirsch.

## Installation

```bash
# Install the analytics library
pnpm install @stacksee/analytics

# Install the Pirsch SDK
pnpm install pirsch-sdk
```

## Client-Side Usage

The Pirsch client provider uses the `pirsch-sdk/web` module for browser environments.

### Basic Setup

```typescript
import { createClientAnalytics } from '@stacksee/analytics/client';
import { PirschClientProvider } from '@stacksee/analytics/providers/client';

const analytics = createClientAnalytics({
  providers: [
    new PirschClientProvider({
      identificationCode: 'your-pirsch-identification-code',
      hostname: 'example.com' // optional
    })
  ]
});

await analytics.initialize();
```

### Configuration Options

```typescript
interface PirschClientConfig {
  identificationCode: string;  // Required: Your Pirsch identification code
  hostname?: string;           // Optional: The domain being tracked
  debug?: boolean;             // Optional: Enable debug logging (default: false)
  enabled?: boolean;           // Optional: Enable/disable provider (default: true)
}
```

### Getting Your Identification Code

1. Log in to your Pirsch dashboard
2. Go to **Settings** > **Integrations**
3. Find the **JavaScript Snippet** section
4. Copy your **Identification Code**

### Example

```typescript
new PirschClientProvider({
  identificationCode: 'AbCdEfGh1234567890',
  hostname: 'myapp.com',
  debug: process.env.NODE_ENV === 'development'
})
```

## Server-Side Usage

The Pirsch server provider uses the `pirsch-sdk` module for Node.js environments.

### Basic Setup

```typescript
import { createServerAnalytics } from '@stacksee/analytics/server';
import { PirschServerProvider } from '@stacksee/analytics/providers/server';

const analytics = createServerAnalytics({
  providers: [
    new PirschServerProvider({
      hostname: 'example.com',
      clientSecret: process.env.PIRSCH_ACCESS_KEY, // or client secret
      clientId: process.env.PIRSCH_CLIENT_ID,      // if using OAuth
      protocol: 'https'                            // optional, default: https
    })
  ]
});

analytics.initialize();

// Track events
await analytics.track('button_clicked', {
  buttonId: 'signup-cta'
}, {
  userId: 'user-123'
});

await analytics.shutdown();
```

### Configuration Options

```typescript
interface PirschServerConfig {
  hostname: string;                // Required: Domain being tracked
  clientSecret: string;            // Required: Access key or client secret
  protocol?: 'http' | 'https';     // Optional: Default is "https"
  clientId?: string;               // Optional: For OAuth authentication
  trustedProxyHeaders?: string[];  // Optional: IP extraction headers
  debug?: boolean;                 // Optional: Enable debug logging
  enabled?: boolean;               // Optional: Enable/disable provider
}
```

### Authentication Methods

Pirsch supports two authentication methods:

#### 1. Access Key (Recommended)

Access keys start with `pa_` and provide write-only access without requiring token requests.

```typescript
new PirschServerProvider({
  hostname: 'example.com',
  clientSecret: 'pa_your_access_key_here'
})
```

**Benefits:**
- Single credential
- No token refresh needed
- Reduced server overhead
- Simpler configuration

#### 2. OAuth (Client ID + Secret)

For full API access including data retrieval:

```typescript
new PirschServerProvider({
  hostname: 'example.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
})
```

### Getting Your API Credentials

1. Log in to your Pirsch dashboard
2. Go to **Settings** > **API**
3. Create a new **Access Key** or **OAuth Client**
4. Copy your credentials

### Example with Environment Variables

```typescript
// .env file
PIRSCH_HOSTNAME=example.com
PIRSCH_ACCESS_KEY=pa_your_access_key
# OR for OAuth:
PIRSCH_CLIENT_ID=your-client-id
PIRSCH_CLIENT_SECRET=your-client-secret

// Server code
new PirschServerProvider({
  hostname: process.env.PIRSCH_HOSTNAME!,
  clientSecret: process.env.PIRSCH_ACCESS_KEY!,
  debug: process.env.NODE_ENV === 'development'
})
```

## Tracking Features

### Page Views

Pirsch automatically tracks page views through the `hit()` method:

```typescript
// Client-side - tracks current page automatically
analytics.pageView();

// Server-side - provide page context
analytics.pageView({}, {
  context: {
    page: {
      path: '/products/widget',
      title: 'Product Widget',
      referrer: 'https://google.com'
    }
  }
});
```

### Custom Events

Track custom events with metadata:

```typescript
await analytics.track('video_watched', {
  videoId: 'intro-tutorial',
  duration: 120,
  completionRate: 0.85
});
```

### Event Duration

For events with duration (e.g., video watch time), Pirsch will automatically handle this through the event metadata.

### User Identification

While Pirsch is privacy-focused and doesn't track individual users by default, you can still use the `identify` method to track custom user events:

```typescript
// This creates a custom "user_identified" event
analytics.identify('user-123', {
  plan: 'pro',
  company: 'Acme Corp'
});
```

## Proxy Headers

If your application is behind a proxy (CDN, load balancer), configure trusted headers for accurate IP detection:

```typescript
new PirschServerProvider({
  hostname: 'example.com',
  clientSecret: 'pa_...',
  trustedProxyHeaders: [
    'cf-connecting-ip',    // Cloudflare
    'x-forwarded-for',     // Standard proxy header
    'x-real-ip'            // Nginx
  ]
})
```

**Available headers:**
- `cf-connecting-ip` - Cloudflare
- `x-forwarded-for` - Standard proxy
- `forwarded` - RFC 7239
- `x-real-ip` - Nginx/custom

## Client Hints

For improved accuracy in browser statistics, Pirsch supports Client Hints headers. The client-side provider automatically sends these when available.

Server-side implementations should forward these headers from the request:
- `Sec-CH-UA`
- `Sec-CH-UA-Mobile`
- `Sec-CH-UA-Platform`
- `Sec-CH-UA-Platform-Version`
- `Sec-CH-Width`
- `Sec-CH-Viewport-Width`

## Privacy & Cookie-Free Tracking

Pirsch is designed for privacy:

✅ **No cookies** - Compliant with GDPR, CCPA, and PECR
✅ **No personal data** - IP addresses are anonymized
✅ **No cross-site tracking** - Only tracks your domain
✅ **Privacy-focused** - EU-hosted option available

## Serverless Environments

Always call `shutdown()` in serverless environments:

```typescript
// Vercel Functions
import { waitUntil } from '@vercel/functions';

export default async function handler(req, res) {
  const analytics = createServerAnalytics({
    providers: [
      new PirschServerProvider({
        hostname: 'example.com',
        clientSecret: process.env.PIRSCH_ACCESS_KEY
      })
    ]
  });

  analytics.initialize();

  waitUntil(
    analytics.track('api_request', { endpoint: req.url })
      .then(() => analytics.shutdown())
  );

  res.status(200).json({ success: true });
}
```

## Middleware Pattern (Recommended)

For server-side tracking, Pirsch recommends using middleware to automatically track all page views:

```typescript
// Express.js example
app.use(async (req, res, next) => {
  // Track page view
  await analytics.pageView({
    source: 'server'
  }, {
    context: {
      page: {
        path: req.url,
        referrer: req.headers.referer
      }
    }
  });

  next();
});
```

## Rate Limits

Pirsch API rate limits:

| Endpoint Type | Rate Limit |
|--------------|------------|
| Security endpoints | 10 requests/minute |
| Configuration endpoints | 60 requests/minute |
| Data collection | Unlimited |

The data collection endpoints (used by this provider) have no rate limits.

## Type Safety

All Pirsch configuration options are fully typed. Import the types if needed:

```typescript
import type { PirschClientConfig } from '@stacksee/analytics/providers/client';
import type { PirschServerConfig } from '@stacksee/analytics/providers/server';
```

## Limitations

### Client-Side
- Requires browser environment (no SSR)
- Dynamically imports `pirsch-sdk/web`
- Identification is tracked as custom events (not native user tracking)

### Server-Side
- Requires `pirsch-sdk` package
- Must provide hostname in configuration
- OAuth tokens auto-refresh when using client ID/secret

## Differences from Other Providers

Unlike traditional analytics providers, Pirsch:

- **No user tracking** - Privacy-first approach
- **No cookies** - Fully compliant with privacy regulations
- **Simple events** - Events with metadata rather than complex user journeys
- **Page-centric** - Focused on page views and content analytics

## Resources

- [Pirsch Documentation](https://docs.pirsch.io/)
- [Pirsch JavaScript SDK](https://github.com/pirsch-analytics/pirsch-js-sdk)
- [Pirsch API Guide](https://docs.pirsch.io/api-sdks/api-guide)
- [Backend Integration Guide](https://docs.pirsch.io/get-started/backend-integration)
- [Pirsch Dashboard](https://pirsch.io/)

## Self-Hosted Option

Pirsch offers a self-hosted version. Contact Pirsch for details on self-hosting configurations.
