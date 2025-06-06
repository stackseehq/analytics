// Predefined event categories
export type PredefinedEventCategory =
	| "engagement"
	| "user"
	| "navigation"
	| "error"
	| "performance"
	| "conversion";

// Allow custom categories while maintaining autocomplete
export type EventCategory =
	| PredefinedEventCategory
	| (string & Record<never, never>);

export interface BaseEvent {
	category: EventCategory;
	action: string;
	timestamp?: number;
	userId?: string;
	sessionId?: string;
	properties?: Record<string, unknown>;
}

export interface EventContext {
	page?: {
		path: string;
		title?: string;
		referrer?: string;
	};
	device?: {
		type?: string;
		os?: string;
		browser?: string;
	};
	utm?: {
		source?: string;
		medium?: string;
		name?: string;
	};
}

export interface AnalyticsProvider {
	name: string;
	initialize(): Promise<void> | void;
	identify(
		userId: string,
		traits?: Record<string, unknown>,
	): Promise<void> | void;
	track(event: BaseEvent, context?: EventContext): Promise<void> | void;
	page(
		properties?: Record<string, unknown>,
		context?: EventContext,
	): Promise<void> | void;
	reset(): Promise<void> | void;
}

export interface AnalyticsConfig {
	providers: AnalyticsProvider[];
	debug?: boolean;
	enabled?: boolean;
	defaultContext?: Partial<EventContext>;
}

// Type helpers for creating strongly typed events
export type EventDefinition<T extends string, P = Record<string, unknown>> = {
	name: T;
	category: EventCategory;
	properties?: P;
};

export type ExtractEventName<T> = T extends EventDefinition<infer N, unknown>
	? N
	: never;
export type ExtractEventProperties<T> = T extends EventDefinition<
	string,
	infer P
>
	? P
	: never;
