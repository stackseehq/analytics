// Base provider for extending
export { BaseAnalyticsProvider } from "./base.provider.js";

// PostHog providers
export { PostHogClientProvider } from "./posthog/client.js";
export { PostHogServerProvider } from "./posthog/server.js";

// PostHog types - re-export from official packages
export type { PostHogConfig } from "posthog-js";
export type { PostHogOptions } from "posthog-node";
