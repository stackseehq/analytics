export interface PostHogConfig {
	apiKey: string;
	host?: string;
	autocapture?: boolean;
	capturePageview?: boolean;
	capturePageleave?: boolean;
	debug?: boolean;
	disableCookie?: boolean;
	persistenceType?: "cookie" | "localStorage" | "memory";
	personProfiles?: "always" | "never" | "identified_only";
}

export interface PostHogInstance {
	init(apiKey: string, config?: Partial<PostHogConfig>): void;
	identify(distinctId: string, properties?: Record<string, unknown>): void;
	capture(event: string, properties?: Record<string, unknown>): void;
	reset(): void;
	debug(enabled?: boolean): void;
	opt_out_capturing(): void;
	opt_in_capturing(): void;
	has_opted_out_capturing(): boolean;
	get_distinct_id(): string;
	alias(alias: string): void;
	set_config(config: Partial<PostHogConfig>): void;
	get_config<K extends keyof PostHogConfig>(key: K): PostHogConfig[K];
	capture_pageview(): void;
	capture_pageleave(): void;
}
