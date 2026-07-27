// Server-only providers - Node.js only
export { BaseAnalyticsProvider } from "./base.provider.js";
export { PostHogServerProvider } from "./posthog/server.js";

// PostHog server types only
export type { PostHogOptions } from "posthog-node";

// OpenPanel server provider
export { OpenPanelServerProvider } from "./openpanel/server.js";
export type { OpenPanelServerConfig } from "./openpanel/server.js";

// Bento server provider
export { BentoServerProvider } from "./bento/server.js";
export type {
	BentoServerConfig,
	BentoAnalyticsOptions,
} from "./bento/server.js";

// Pirsch server provider
export { PirschServerProvider } from "./pirsch/server.js";
export type { PirschServerConfig } from "./pirsch/server.js";

// EmitKit server provider
export { EmitKitServerProvider } from "./emitkit/server.js";
export type { EmitKitServerConfig } from "./emitkit/server.js";

// Proxy helpers (for ingesting client-side events)
export {
	ingestProxyEvents,
	createProxyHandler,
	ProxyIngestError,
	ProxyTrustError,
} from "./proxy/server.js";
export type {
	IngestProxyEventsConfig,
	ProxyIngestErrorCode,
	ProxyTrustedIdentity,
	ProxyTrustErrorCode,
} from "./proxy/server.js";
export type {
	ProxyClientContext,
	ProxyEventV2,
	ProxyPayloadV2,
	ProxyTrackEventV2,
	ProxyIdentifyEventV2,
	ProxyPageViewEventV2,
	ProxyResetEventV2,
} from "./proxy/types.js";
