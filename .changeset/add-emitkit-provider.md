---
"@stacksee/analytics": minor
---

feat: add EmitKit server provider

Adds support for EmitKit as a server-side analytics provider. EmitKit is a notification and event tracking service that allows you to send events to channels with rich metadata.

**New Provider:**
- `EmitKitServerProvider` - Server-side provider for EmitKit API

**Features:**
- User identification with alias support (email, username, custom identifiers)
- Event tracking with configurable channels and rich metadata
- Page view tracking
- Auto-formatted event titles and category-based icons
- Support for tags, notifications, and display modes
- Rate limit handling

**Configuration:**
```typescript
import { EmitKitServerProvider } from '@stacksee/analytics/providers/server';

const analytics = new ServerAnalytics({
  providers: [
    new EmitKitServerProvider({
      apiKey: 'emitkit_xxxxx',
      channelName: 'analytics',
      notify: true,
      displayAs: 'notification'
    })
  ]
});
```

**Note:** EmitKit is server-only. For client-side events, use the proxy pattern to forward events from the browser to your server endpoint.
