import type { BaseEvent, EventContext } from "@/core/events/types.js";

/**
 * Proxy event types for batching and sending to server
 */
export type ProxyTrackEvent = {
	type: "track";
	event: BaseEvent;
	context?: EventContext;
};

export type ProxyIdentifyEvent = {
	type: "identify";
	userId: string;
	traits?: Record<string, unknown>;
};

export type ProxyPageViewEvent = {
	type: "pageView";
	properties?: Record<string, unknown>;
	context?: EventContext;
};

export type ProxyResetEvent = {
	type: "reset";
};

export type ProxyEvent =
	| ProxyTrackEvent
	| ProxyIdentifyEvent
	| ProxyPageViewEvent
	| ProxyResetEvent;

/**
 * Payload sent to the proxy endpoint
 */
export interface ProxyPayload {
	events: ProxyEvent[];
}

/**
 * Configuration for batching behavior
 */
export interface ProxyBatchConfig {
	/**
	 * Maximum number of events before auto-flush
	 * @default 10
	 */
	size?: number;
	/**
	 * Maximum time in ms before auto-flush
	 * @default 5000
	 */
	interval?: number;
}

/**
 * Configuration for retry behavior
 */
export interface ProxyRetryConfig {
	/**
	 * Maximum retry attempts
	 * @default 3
	 */
	attempts?: number;
	/**
	 * Backoff strategy
	 * @default 'exponential'
	 */
	backoff?: "exponential" | "linear";
	/**
	 * Initial delay in ms
	 * @default 1000
	 */
	initialDelay?: number;
}
