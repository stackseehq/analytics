import type { EventContext } from "@/core/events/types.js";

/**
 * Browser-owned context fields that are safe to carry across the proxy
 * transport boundary. Identity, server fields, and IP addresses are resolved
 * on the server.
 */
export type ProxyClientContext = Pick<EventContext, "page" | "utm"> & {
	device?: Omit<NonNullable<EventContext["device"]>, "ip">;
};

export interface ProxyTrackEventV2 {
	type: "track";
	name: string;
	inputProvided: boolean;
	input?: unknown;
	occurredAt: number;
	sessionId?: string;
	context?: ProxyClientContext;
}

export interface ProxyIdentifyEventV2 {
	type: "identify";
	userId: string;
	traits?: Record<string, unknown>;
}

export interface ProxyPageViewEventV2 {
	type: "pageView";
	properties?: Record<string, unknown>;
	occurredAt: number;
	context?: ProxyClientContext;
}

export interface ProxyResetEventV2 {
	type: "reset";
}

export type ProxyEventV2 =
	| ProxyTrackEventV2
	| ProxyIdentifyEventV2
	| ProxyPageViewEventV2
	| ProxyResetEventV2;

/**
 * Payload sent to the proxy endpoint
 */
export interface ProxyPayloadV2 {
	version: 2;
	events: ProxyEventV2[];
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
