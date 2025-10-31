# Proxy Provider

The Proxy Provider enables you to bypass client-side tracking SDKs and route events through your own server endpoint. This solves common issues like:

- **Ad-blockers**: Browser extensions blocking analytics scripts
- **Privacy compliance**: Control data flow through your own infrastructure
- **Server-side enrichment**: Add server context (real IP, auth data) to events
- **Unified tracking**: Use the same simple client API while tracking server-side

## How It Works

```
Client (Browser)                Server                  Analytics Services
─────────────────              ─────────              ──────────────────

analytics.track()
      │
      │  Batches events
      ▼
ProxyProvider
      │
      │  POST /api/events
      ▼
                           ──────────────
                           ingestProxyEvents
                                 │
                                 ├──► PirschServerProvider
                                 ├──► PostHogServerProvider
                                 └──► BentoServerProvider
```

Events are batched on the client, sent to your API endpoint, then ingested and forwarded to your configured server-side providers.

## Installation

No additional dependencies needed - the Proxy Provider is included in the core library.

## Quick Start

### 1. Client-Side Setup

```typescript
import { createClientAnalytics } from '@stacksee/analytics/client';
import { ProxyProvider } from '@stacksee/analytics/providers/client';

const analytics = createClientAnalytics({
  providers: [
    new ProxyProvider({
      endpoint: '/api/events',
      // Optional: Configure batching
      batch: {
        size: 10,        // Send after 10 events
        interval: 5000   // Or after 5 seconds
      }
    })
  ]
});

// Use exactly like normal - events are batched and sent to your server
await analytics.track('button_clicked', {
  buttonId: 'signup-cta'
});

analytics.identify('user-123', {
  email: 'user@example.com'
});

analytics.pageView();
```

### 2. Server-Side Setup

#### Next.js App Router

```typescript
// app/api/events/route.ts
import { createServerAnalytics } from '@stacksee/analytics/server';
import {
  PirschServerProvider,
  ingestProxyEvents
} from '@stacksee/analytics/providers/server';

// Configure your real analytics providers
const serverAnalytics = createServerAnalytics({
  providers: [
    new PirschServerProvider({
      hostname: 'example.com',
      clientSecret: process.env.PIRSCH_SECRET!
    })
  ]
});

export async function POST(req: Request) {
  // Automatically processes and forwards events
  await ingestProxyEvents(req, serverAnalytics);
  return new Response('OK');
}
```

#### Or use the helper for cleaner code:

```typescript
// app/api/events/route.ts
import { createServerAnalytics } from '@stacksee/analytics/server';
import {
  PirschServerProvider,
  createProxyHandler
} from '@stacksee/analytics/providers/server';

const serverAnalytics = createServerAnalytics({
  providers: [
    new PirschServerProvider({
      hostname: 'example.com',
      clientSecret: process.env.PIRSCH_SECRET!
    })
  ]
});

// One-liner handler
export const POST = createProxyHandler(serverAnalytics);
```

#### Next.js Pages Router

```typescript
// pages/api/events.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerAnalytics } from '@stacksee/analytics/server';
import {
  PirschServerProvider,
  ingestProxyEvents
} from '@stacksee/analytics/providers/server';

const serverAnalytics = createServerAnalytics({
  providers: [
    new PirschServerProvider({
      hostname: 'example.com',
      clientSecret: process.env.PIRSCH_SECRET!
    })
  ]
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  // Convert to standard Request
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: new Headers(req.headers as Record<string, string>),
    body: JSON.stringify(req.body)
  });

  await ingestProxyEvents(request, serverAnalytics);
  res.status(200).send('OK');
}
```

#### SvelteKit

```typescript
// src/routes/api/events/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServerAnalytics } from '@stacksee/analytics/server';
import {
  PirschServerProvider,
  ingestProxyEvents
} from '@stacksee/analytics/providers/server';

const serverAnalytics = createServerAnalytics({
  providers: [
    new PirschServerProvider({
      hostname: 'example.com',
      clientSecret: process.env.PIRSCH_SECRET!
    })
  ]
});

export const POST: RequestHandler = async ({ request }) => {
  await ingestProxyEvents(request, serverAnalytics);
  return json({ ok: true });
};
```

#### Express.js

```typescript
import express from 'express';
import { createServerAnalytics } from '@stacksee/analytics/server';
import {
  PirschServerProvider,
  ingestProxyEvents
} from '@stacksee/analytics/providers/server';

const app = express();
app.use(express.json());

const serverAnalytics = createServerAnalytics({
  providers: [
    new PirschServerProvider({
      hostname: 'example.com',
      clientSecret: process.env.PIRSCH_SECRET!
    })
  ]
});

app.post('/api/events', async (req, res) => {
  // Convert Express request to standard Request
  const request = new Request(`${req.protocol}://${req.get('host')}${req.url}`, {
    method: req.method,
    headers: new Headers(req.headers as Record<string, string>),
    body: JSON.stringify(req.body)
  });

  await ingestProxyEvents(request, serverAnalytics);
  res.send('OK');
});
```

## Configuration

### ProxyProvider Options

```typescript
new ProxyProvider({
  // Required: Your server endpoint
  endpoint: '/api/events',

  // Optional: Batching configuration
  batch: {
    size: 10,        // Max events before auto-flush (default: 10)
    interval: 5000   // Max time in ms before auto-flush (default: 5000)
  },

  // Optional: Retry configuration
  retry: {
    attempts: 3,           // Max retry attempts (default: 3)
    backoff: 'exponential',// 'exponential' | 'linear' (default: 'exponential')
    initialDelay: 1000     // Initial delay in ms (default: 1000)
  },

  // Optional: Custom headers
  headers: {
    'X-Custom-Header': 'value'
  },

  // Optional: Debug mode
  debug: true,

  // Optional: Enable/disable
  enabled: true
})
```

### Server-Side Configuration

#### Custom IP Extraction

If you're behind a proxy (Cloudflare, nginx, etc.), configure IP extraction:

```typescript
// Cloudflare
await ingestProxyEvents(req, serverAnalytics, {
  extractIp: (req) => req.headers.get('cf-connecting-ip')
});

// nginx
await ingestProxyEvents(req, serverAnalytics, {
  extractIp: (req) => req.headers.get('x-real-ip')
});

// AWS ALB
await ingestProxyEvents(req, serverAnalytics, {
  extractIp: (req) => {
    const forwarded = req.headers.get('x-forwarded-for');
    return forwarded?.split(',')[0]?.trim();
  }
});
```

#### Context Enrichment

Add server-side data to all events:

```typescript
await ingestProxyEvents(req, serverAnalytics, {
  enrichContext: (req) => ({
    server: {
      region: process.env.AWS_REGION,
      version: process.env.APP_VERSION
    },
    request: {
      country: req.headers.get('cf-ipcountry')
    }
  })
});
```

#### Error Handling

```typescript
await ingestProxyEvents(req, serverAnalytics, {
  onError: (error) => {
    console.error('Failed to process event:', error);
    // Send to error tracking service
    Sentry.captureException(error);
  }
});
```

## Advanced Patterns

### Multiple Providers

Use multiple analytics services simultaneously:

```typescript
// Server-side
const serverAnalytics = createServerAnalytics({
  providers: [
    // Privacy-focused analytics
    new PirschServerProvider({
      hostname: 'example.com',
      clientSecret: process.env.PIRSCH_SECRET!
    }),

    // Product analytics
    new PostHogServerProvider({
      token: process.env.POSTHOG_KEY!
    }),

    // Email marketing
    new BentoServerProvider({
      siteUuid: process.env.BENTO_SITE_UUID!,
      authentication: {
        publishableKey: process.env.BENTO_PUB_KEY!,
        secretKey: process.env.BENTO_SECRET_KEY!
      }
    })
  ]
});

// Client sends once, all providers receive events
await analytics.track('purchase', { amount: 99.99 });
```

### Hybrid Setup

Combine proxy with direct tracking for non-critical events:

```typescript
// Critical events go through proxy (avoid ad-blockers)
const analytics = createClientAnalytics({
  providers: [
    new ProxyProvider({
      endpoint: '/api/events'
    }),

    // Optional: Still track directly for real-time features
    new PostHogClientProvider({
      token: process.env.NEXT_PUBLIC_POSTHOG_KEY!,
      enabled: !import.meta.env.PROD // Only in dev
    })
  ]
});
```

### Manual Flush Control

```typescript
const proxyProvider = new ProxyProvider({
  endpoint: '/api/events',
  batch: {
    size: 100,      // Large batch
    interval: 30000 // Long interval
  }
});

// Track events
analytics.track('event1');
analytics.track('event2');

// Manually flush when needed
await proxyProvider.flush();
```

### Conditional Routing

Route different events to different endpoints:

```typescript
// Use multiple proxy providers for different event types
const criticalProxy = new ProxyProvider({
  endpoint: '/api/events/critical',
  batch: { size: 1, interval: 0 } // Immediate send
});

const analyticsProxy = new ProxyProvider({
  endpoint: '/api/events/analytics',
  batch: { size: 50, interval: 10000 } // Large batches
});
```

## Event Payload Format

The ProxyProvider sends events in this format:

```typescript
{
  events: [
    {
      type: 'track',
      event: {
        action: 'button_clicked',
        category: 'engagement',
        properties: { buttonId: 'signup-cta' },
        timestamp: 1699564800000,
        userId: 'user-123',
        sessionId: 'session-456'
      },
      context: {
        page: {
          path: '/pricing',
          url: 'https://example.com/pricing',
          title: 'Pricing - Example',
          referrer: 'https://google.com'
        },
        device: {
          userAgent: 'Mozilla/5.0...',
          language: 'en-US',
          timezone: 'America/New_York',
          screen: { width: 1920, height: 1080 },
          viewport: { width: 1440, height: 900 }
        }
      }
    },
    {
      type: 'identify',
      userId: 'user-123',
      traits: {
        email: 'user@example.com',
        plan: 'pro'
      }
    },
    {
      type: 'pageView',
      properties: { experiment: 'v2' },
      context: { /* ... */ }
    }
  ]
}
```

## Batching & Reliability

### Automatic Flushing

Events are automatically flushed when:
- Batch size is reached (default: 10 events)
- Time interval expires (default: 5 seconds)
- Page unload (beforeunload event)
- Page visibility changes to hidden (mobile Safari)

### Beacon API

On page unload, the ProxyProvider uses `navigator.sendBeacon()` for reliable delivery:

```typescript
// Automatically handled - no configuration needed
window.addEventListener('beforeunload', () => {
  // Uses beacon API automatically
  proxyProvider.flush();
});
```

### Retry Logic

Failed requests are automatically retried with exponential backoff:

```typescript
new ProxyProvider({
  endpoint: '/api/events',
  retry: {
    attempts: 3,          // Retry up to 3 times
    backoff: 'exponential',// 1s, 2s, 4s
    initialDelay: 1000
  }
})
```

## Performance Considerations

### Batching Recommendations

- **High-traffic sites**: Larger batches (50-100 events, 10s interval)
- **Real-time needs**: Smaller batches (5-10 events, 2s interval)
- **Critical events**: Immediate send (size: 1, interval: 0)

```typescript
// High-traffic configuration
new ProxyProvider({
  endpoint: '/api/events',
  batch: {
    size: 100,
    interval: 10000
  }
})

// Real-time configuration
new ProxyProvider({
  endpoint: '/api/events',
  batch: {
    size: 5,
    interval: 2000
  }
})
```

### Network Overhead

The ProxyProvider adds minimal overhead:
- Average event: ~500 bytes
- Batch of 10 events: ~5KB
- Compressed (gzip): ~1-2KB

### Server Considerations

Your `/api/events` endpoint should:
- Return quickly (< 100ms ideally)
- Process events asynchronously if needed
- Handle failures gracefully
- Rate limit if exposed publicly

```typescript
// Example with async processing
export async function POST(req: Request) {
  const payload = await req.json();

  // Process asynchronously (don't await)
  processEvents(payload).catch(console.error);

  // Return immediately
  return new Response('OK');
}

async function processEvents(payload: ProxyPayload) {
  for (const event of payload.events) {
    await serverAnalytics.track(event.event, event.context);
  }
}
```

## Troubleshooting

### Events Not Being Sent

1. Check browser console for errors
2. Enable debug mode:
```typescript
new ProxyProvider({
  endpoint: '/api/events',
  debug: true // Logs all batches
})
```

3. Verify endpoint is reachable:
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"events":[]}'
```

### Events Not Reaching Analytics Providers

1. Enable debug on server analytics:
```typescript
const serverAnalytics = createServerAnalytics({
  providers: [
    new PirschServerProvider({
      // ...
      debug: true
    })
  ]
});
```

2. Check server logs for errors
3. Verify provider credentials

### CORS Issues

If your API is on a different domain:

```typescript
// Server-side CORS headers
export async function POST(req: Request) {
  await ingestProxyEvents(req, serverAnalytics);

  return new Response('OK', {
    headers: {
      'Access-Control-Allow-Origin': 'https://your-frontend.com',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
```

## Best Practices

1. **Always use HTTPS** for production endpoints
2. **Rate limit** your `/api/events` endpoint to prevent abuse
3. **Validate payload** on the server before processing
4. **Monitor endpoint performance** - slow responses delay client-side code
5. **Use appropriate batch sizes** based on your traffic patterns
6. **Enable debug mode** during development
7. **Test page unload events** - they use different code paths
8. **Consider costs** - server-side tracking may increase server load

## Example: Complete Implementation

### Client-Side (React/Next.js)

```typescript
// lib/analytics.ts
import { createClientAnalytics } from '@stacksee/analytics/client';
import { ProxyProvider } from '@stacksee/analytics/providers/client';

export const analytics = createClientAnalytics({
  providers: [
    new ProxyProvider({
      endpoint: '/api/events',
      batch: {
        size: 10,
        interval: 5000
      },
      debug: process.env.NODE_ENV === 'development'
    })
  ]
});

// components/SignupButton.tsx
import { analytics } from '@/lib/analytics';

export function SignupButton() {
  const handleClick = () => {
    analytics.track('signup_button_clicked', {
      location: 'hero',
      variant: 'primary'
    });
  };

  return <button onClick={handleClick}>Sign Up</button>;
}
```

### Server-Side (Next.js App Router)

```typescript
// app/api/events/route.ts
import { createServerAnalytics } from '@stacksee/analytics/server';
import {
  PirschServerProvider,
  PostHogServerProvider,
  createProxyHandler
} from '@stacksee/analytics/providers/server';

const serverAnalytics = createServerAnalytics({
  providers: [
    new PirschServerProvider({
      hostname: process.env.NEXT_PUBLIC_DOMAIN!,
      clientSecret: process.env.PIRSCH_SECRET!,
      debug: process.env.NODE_ENV === 'development'
    }),
    new PostHogServerProvider({
      token: process.env.POSTHOG_KEY!,
      debug: process.env.NODE_ENV === 'development'
    })
  ]
});

export const POST = createProxyHandler(serverAnalytics, {
  extractIp: (req) => req.headers.get('x-forwarded-for'),
  enrichContext: () => ({
    server: {
      environment: process.env.NODE_ENV,
      region: process.env.VERCEL_REGION
    }
  }),
  onError: (error) => {
    console.error('[Analytics] Error:', error);
  }
});
```

## Migration Guide

### From Direct Provider to Proxy

**Before:**
```typescript
// Client
new PirschClientProvider({
  identificationCode: 'xxx'
})
```

**After:**
```typescript
// Client
new ProxyProvider({
  endpoint: '/api/events'
})

// Server
new PirschServerProvider({
  hostname: 'example.com',
  clientSecret: process.env.PIRSCH_SECRET!
})
```

Your tracking code stays the same - just swap the provider!

## See Also

- [Custom Providers Guide](./custom-providers.md)
- [Server Analytics](../server-analytics.md)
- [Pirsch Provider](./pirsch.md)
- [PostHog Provider](./posthog.md)
