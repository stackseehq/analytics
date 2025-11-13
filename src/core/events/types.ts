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

export interface UserContext<
	TTraits extends Record<string, unknown> = Record<string, unknown>,
> {
	userId?: string;
	email?: string;
	traits?: TTraits;
}

/**
 * Server-side context enrichment
 * Used by server analytics to add request-specific metadata
 */
export interface ServerContext {
	userAgent?: string;
	ip?: string;
	requestId?: string;
	timestamp?: number;
	[key: string]: unknown;
}

export interface EventContext<
	TTraits extends Record<string, unknown> = Record<string, unknown>,
> {
	user?: UserContext<TTraits>;
	page?: {
		path: string;
		title?: string;
		referrer?: string;
		url?: string;
		host?: string;
		protocol?: string;
		search?: string;
	};
	device?: {
		type?: string;
		os?: string;
		browser?: string;
		userAgent?: string;
		language?: string;
		timezone?: string;
		ip?: string;
		screen?: {
			width?: number;
			height?: number;
		};
		viewport?: {
			width?: number;
			height?: number;
		};
	};
	utm?: {
		source?: string;
		medium?: string;
		name?: string;
	};
	server?: ServerContext;
}

export interface AnalyticsProvider {
	name: string;
	initialize(): Promise<void> | void;
	identify(
		userId: string,
		traits?: Record<string, unknown>,
	): Promise<void> | void;
	track(event: BaseEvent, context?: EventContext): Promise<void> | void;
	pageView(
		properties?: Record<string, unknown>,
		context?: EventContext,
	): Promise<void> | void;
	pageLeave?(
		properties?: Record<string, unknown>,
		context?: EventContext,
	): Promise<void> | void;
	reset(): Promise<void> | void;
}

/**
 * Provider methods that can be selectively enabled/disabled through routing
 */
export type ProviderMethod =
	| "initialize"
	| "identify"
	| "track"
	| "pageView"
	| "pageLeave"
	| "reset";

/**
 * Configuration for selective provider method routing.
 * Allows you to control which methods are called on a specific provider.
 *
 * @example
 * ```typescript
 * // Only call track and identify, skip pageView
 * {
 *   provider: new BentoClientProvider({...}),
 *   methods: ['track', 'identify']
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Call all methods except pageView
 * {
 *   provider: new GoogleAnalyticsProvider({...}),
 *   exclude: ['pageView']
 * }
 * ```
 */
export interface ProviderConfig {
	/**
	 * The analytics provider instance
	 */
	provider: AnalyticsProvider;
	/**
	 * Only call these methods on this provider.
	 * If specified, all other methods will be skipped.
	 * Mutually exclusive with `exclude`.
	 */
	methods?: ProviderMethod[];
	/**
	 * Skip these methods on this provider.
	 * All other methods will be called normally.
	 * Mutually exclusive with `methods`.
	 */
	exclude?: ProviderMethod[];
}

/**
 * Provider configuration - supports both simple provider instances
 * and advanced routing configurations
 */
export type ProviderConfigOrProvider = AnalyticsProvider | ProviderConfig;

export interface AnalyticsConfig {
	providers: ProviderConfigOrProvider[];
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
