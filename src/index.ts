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
	EventMapFromCollection,
} from "@/core/events/index.js";

// Client exports
export {
	createAnalytics as createClientAnalytics,
	getAnalytics,
	track as trackClient,
	identify as identifyClient,
	pageView as pageViewClient,
	pageLeave as pageLeaveClient,
	reset as resetClient,
	type ClientAnalyticsConfig,
} from "./client.js";

// Note: Server exports are available at @stacksee/analytics/server
// to avoid Node.js dependencies when importing from main entry point

// Client provider exports (server providers available at @stacksee/analytics/providers)
export {
	BaseAnalyticsProvider,
	PostHogClientProvider,
	type PostHogConfig,
} from "./providers/client.js";

// Re-export analytics classes for advanced use cases
export { BrowserAnalytics } from "./adapters/client/browser-analytics.js";
