# @stacksee/analytics

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
