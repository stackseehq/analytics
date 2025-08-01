import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import type { PostHogConfig } from "@/providers/posthog/types.js";
import type { PostHog } from "posthog-js";
import { isBrowser } from "@/utils/environment.js";

export class PostHogClientProvider extends BaseAnalyticsProvider {
	name = "PostHog-Client";
	private posthog?: PostHog;
	private initialized = false;
	private config: PostHogConfig;

	constructor(config: PostHogConfig & { debug?: boolean; enabled?: boolean }) {
		super({ debug: config.debug, enabled: config.enabled });
		this.config = config;
	}

	async initialize(): Promise<void> {
		if (!this.isEnabled()) return;
		if (this.initialized) return;

		// Check if we're in a browser environment
		if (!isBrowser()) {
			this.log("Skipping initialization - not in browser environment");
			return;
		}

		// Validate config has required fields
		if (!this.config.apiKey || typeof this.config.apiKey !== "string") {
			throw new Error("PostHog requires an apiKey");
		}

		try {
			// Dynamically import PostHog to avoid SSR issues
			const { default: posthog } = await import("posthog-js");

			posthog.init(this.config.apiKey, {
				api_host: this.config.host || "https://app.posthog.com",
				autocapture: this.config.autocapture ?? false,
				capture_pageview: this.config.capturePageview ?? false,
				capture_pageleave: this.config.capturePageleave ?? false,
				debug: this.config.debug ?? this.debug,
				disable_cookie: this.config.disableCookie ?? false,
				persistence: this.config.persistenceType ?? "localStorage",
				person_profiles: this.config.personProfiles ?? "identified_only",
			});

			this.posthog = posthog;
			this.initialized = true;

			this.log("Initialized successfully", this.config);
		} catch (error) {
			console.error("[PostHog-Client] Failed to initialize:", error);
			throw error;
		}
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.isEnabled() || !this.initialized || !this.posthog) return;

		this.posthog.identify(userId, traits);
		this.log("Identified user", { userId, traits });
	}

	track(event: BaseEvent, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.posthog) return;

		const properties = {
			...event.properties,
			category: event.category,
			timestamp: event.timestamp || Date.now(),
			...(event.userId && { userId: event.userId }),
			...(event.sessionId && { sessionId: event.sessionId }),
			...(context?.page && { $current_url: context.page.path }),
			...(context?.device && { device: context.device }),
			...(context?.utm && { utm: context.utm }),
		};

		this.posthog.capture(event.action, properties);
		this.log("Tracked event", { event, context });
	}

	page(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.posthog || !isBrowser())
			return;

		const pageProperties = {
			...properties,
			...(context?.page && {
				path: context.page.path,
				title: context.page.title,
				referrer: context.page.referrer,
			}),
		};

		this.posthog.capture("$pageview", pageProperties);
		this.log("Tracked page view", { properties, context });
	}

	reset(): void {
		if (!this.isEnabled() || !this.initialized || !this.posthog || !isBrowser())
			return;

		this.posthog.reset();
		this.log("Reset user session");
	}
}
