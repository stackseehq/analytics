export type {
	EventCategory,
	BaseEvent,
	EventContext,
	AnalyticsProvider,
	AnalyticsConfig,
} from "@/core/events/types.js";

export type {
	CreateEventDefinition,
	ExtractEventNames,
	ExtractEventPropertiesFromCollection,
	EventCollection,
	AnyEventName,
	AnyEventProperties,
} from "@/core/events/index.js";

// Client exports
export {
	createAnalytics as createClientAnalytics,
	getAnalytics,
	track as trackClient,
	identify as identifyClient,
	page as pageClient,
	reset as resetClient,
	type ClientAnalyticsConfig,
} from "./client.js";

// Server exports
export {
	createServerAnalytics,
	ServerAnalytics,
	type ServerAnalyticsConfig,
} from "./server.js";

// Provider exports
export {
	BaseAnalyticsProvider,
	PostHogClientProvider,
	PostHogServerProvider,
	type PostHogConfig,
} from "./providers/index.js";

// Re-export analytics classes for advanced use cases
export { BrowserAnalytics } from "./adapters/client/browser-analytics.js";
