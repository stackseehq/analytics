// Server-only providers - Node.js only
export { BaseAnalyticsProvider } from "./base.provider.js";
export { PostHogServerProvider } from "./posthog/server.js";

// PostHog server types only
export type { PostHogOptions } from "posthog-node";

// Bento server provider
export { BentoServerProvider } from "./bento/server.js";
export type {
	BentoServerConfig,
	BentoAnalyticsOptions,
} from "./bento/server.js";

// Pirsch server provider
export { PirschServerProvider } from "./pirsch/server.js";
export type { PirschServerConfig } from "./pirsch/server.js";

// Proxy helpers (for ingesting client-side events)
export { ingestProxyEvents, createProxyHandler } from "./proxy/server.js";
export type { IngestProxyEventsConfig } from "./proxy/server.js";
