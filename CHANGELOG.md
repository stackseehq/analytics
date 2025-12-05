# @stacksee/analytics

## 0.11.1

### Patch Changes

- Fix proxy provider queue flushing and add manual flush support ([`3b0c775`](https://github.com/stackseehq/analytics/commit/3b0c7750f04f28d695f3f413e69391994f58a048))

  **Bug Fixes:**

  - **Fixed event loss in proxy provider**: Events were being lost when users triggered only 1-2 events because the flush timer wasn't resetting properly. The timer now resets with each new event, ensuring events are flushed after the configured interval from the last event.
  - **Reduced default batch interval**: Changed default `batchInterval` from 5000ms to 2000ms for better responsiveness and fewer lost events.

  **New Features:**

  - **Added `flush()` method**: New method on `BrowserAnalytics` and convenience export from client to manually flush all queued events to providers. This is particularly useful for ensuring critical events are sent before navigation or page unload.

  **Example Usage:**

  ```typescript
  // Ensure critical events are sent before navigation
  await analytics.track("purchase_completed", { orderId: "123" });
  await analytics.flush(); // Wait for confirmation
  window.location.href = "/thank-you";

  // Or use with beacon API for page unload
  await analytics.flush(true); // Uses beacon API for reliability
  ```

  **Technical Details:**

  - Added optional `flush(useBeacon?: boolean)` method to `AnalyticsProvider` interface
  - Proxy provider's `beforeunload` and `visibilitychange` listeners automatically call `flush(true)` with beacon API for reliable delivery during page transitions
  - All providers that implement batching can now be manually flushed

## 0.11.0

### Minor Changes

- feat: add EmitKit server provider ([`b4d5561`](https://github.com/stackseehq/analytics/commit/b4d55618e362f8fd4b7f6e6e0275298c19bd7738))

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
  import { EmitKitServerProvider } from "@stacksee/analytics/providers/server";

  const analytics = new ServerAnalytics({
    providers: [
      new EmitKitServerProvider({
        apiKey: "emitkit_xxxxx",
        channelName: "analytics",
        notify: true,
        displayAs: "notification",
      }),
    ],
  });
  ```

  **Note:** EmitKit is server-only. For client-side events, use the proxy pattern to forward events from the browser to your server endpoint.

## 0.10.0

### Minor Changes

- Add provider routing system for selective method control ([`e9af485`](https://github.com/stackseehq/analytics/commit/e9af485523a433f946035661939370d389435bca))

  Introduces a new provider routing system that allows fine-grained control over which methods are called on specific providers. This enables scenarios like using Bento only for user identification and custom events while excluding page views to reduce noise.

  **New Features:**

  - **Selective method inclusion**: Use the `methods` option to specify which methods should be called on a provider
  - **Method exclusion**: Use the `exclude` option to prevent specific methods from being called
  - **Mixed provider configurations**: Combine simple providers with routed providers in the same setup
  - **Full TypeScript support**: Type-safe method names with autocomplete

  **Example Usage:**

  ```typescript
  const analytics = createClientAnalytics({
    providers: [
      // Simple form - gets all methods
      new PostHogClientProvider({ token: "xxx" }),

      // Exclude page views from Bento
      {
        provider: new BentoClientProvider({ siteUuid: "xxx" }),
        exclude: ["pageView"],
      },

      // CRM only needs identity data
      {
        provider: new CustomCRMProvider({ apiKey: "xxx" }),
        methods: ["identify"],
      },
    ],
  });
  ```

  **Breaking Changes:** None - fully backward compatible with existing code.

## 0.9.8

### Patch Changes

- refactor(proxy): improve type safety and context enrichment

  - **Type Definitions**: Added `ServerContext` interface with fields for `userAgent`, `ip`, `requestId`, and `timestamp`
  - **EventContext Extensions**: Extended `EventContext` with `server?: ServerContext` and added `ip?: string` to device context
  - **Proxy Server**: Reduced `any` type usage by 87.5% in proxy server implementation
  - **User-Agent Enrichment**: Automatically extract and add user-agent from request headers to server context
  - **IP Enrichment**: IP addresses now properly typed in device context (no type assertions needed)
  - **Context Merging**: Fixed type-safe merging of custom enrichContext with automatic server enrichment
  - **Tests**: Updated all proxy server tests to use proper types (removed all `as any` assertions)
  - **Backwards Compatible**: All changes maintain 100% API compatibility

  This improves type safety at the HTTP/JSON boundary while maintaining flexibility for server-side context enrichment.

## 0.9.7

### Patch Changes

- fix(pirsch): resolve network errors from invalid context data

  - Add validation for OAuth authentication requiring both clientId and clientSecret
  - Skip tracking events when IP or User-Agent is missing from context instead of using dummy values
  - Pirsch API rejects invalid/dummy data (like "0.0.0.0" or "unknown"), causing Network Errors
  - Add clear logging when events are skipped due to missing context
  - Update documentation with authentication options and context requirements

## 0.9.6

### Patch Changes

- fix(pirsch): add screen dimensions, viewport, language, and platform tracking

  - Added screen_width and screen_height mapping from client context
  - Added sec_ch_viewport_width for viewport width tracking
  - Added accept_language for language/locale tracking
  - Added sec_ch_ua_mobile and sec_ch_ua_platform for device type and OS tracking
  - Added timezone and browser to event metadata
  - Updated EventContext type to include screen, viewport, userAgent, language, and timezone fields

  This resolves the issue where screen data was showing as null in Pirsch analytics.

## 0.9.5

### Patch Changes

- Fix Pirsch provider tracking issues

  - **PirschServerProvider**: Extract real IP addresses and user-agents from proxy handler context instead of using hardcoded dummy values ("0.0.0.0" and "analytics-library"). Pirsch was rejecting hits with invalid IPs.
  - **PirschServerProvider**: Build full URLs (e.g., "https://example.com/pricing") instead of sending just paths ("/pricing"), as required by Pirsch SDK.
  - **PirschClientProvider**: Optimize page view tracking by passing properties as tags directly to `hit()` call instead of sending a separate event.

## 0.9.4

### Patch Changes

- Release version 0.9.1 ([`d7b9f69`](https://github.com/stackseehq/analytics/commit/d7b9f69c4e23414ca6371c661a8df417af719fe2))

## 0.4.2

### Patch Changes

- Fix build configuration to properly handle Node.js modules by externalizing posthog dependencies ([`3fbd302`](https://github.com/stackseehq/analytics/commit/3fbd30279e8b0fbde9ec26c3c25b98b6decb551e))

## 0.2.0

### Minor Changes

- Initial version ([`9ff5477`](https://github.com/stackseehq/analytics/commit/9ff54778beb3a4b2e32e61619c6e4e7c467fb9cf))
