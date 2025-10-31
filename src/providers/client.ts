// Base provider for extending
export { BaseAnalyticsProvider } from "./base.provider.js";

// PostHog client provider only
export { PostHogClientProvider } from "./posthog/client.js";

// PostHog client types only
export type { PostHogConfig } from "posthog-js";

// Bento client provider
export { BentoClientProvider } from "./bento/client.js";
export type { BentoClientConfig } from "./bento/client.js";