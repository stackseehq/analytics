import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import type { PostHog, PostHogConfig, Properties } from "posthog-js";
import { isBrowser } from "@/utils/environment.js";

export class PostHogClientProvider extends BaseAnalyticsProvider {
	name = "PostHog-Client";
	private posthog?: PostHog;
	private initialized = false;
	private config: Partial<PostHogConfig> & { token: string };

	constructor(
		config: Partial<PostHogConfig> & {
			token: string;
			debug?: boolean;
			enabled?: boolean;
		},
	) {
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
		if (!this.config.token || typeof this.config.token !== "string") {
			throw new Error("PostHog requires a token");
		}

		try {
			// Dynamically import PostHog to avoid SSR issues
			const { default: posthog } = await import("posthog-js");

			const { token, debug: configDebug, ...posthogConfig } = this.config;

			posthog.init(token, {
				...posthogConfig,
				debug: configDebug ?? this.debug,
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
			// Include user email and traits as regular event properties
			...(context?.user?.email && { user_email: context.user.email }),
			...(context?.user?.traits && { user_traits: context.user.traits }),
		};

		this.posthog.capture(event.action, properties);
		this.log("Tracked event", { event, context });
	}

	pageView(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.posthog || !isBrowser())
			return;

		const pageProperties = {
			...properties,
			...(context?.page && {
				path: context.page.path,
				title: context.page.title,
				referrer: context.page.referrer,
			}),
		} satisfies Properties;

		this.posthog.capture("$pageview", pageProperties);
		this.log("Tracked page view", { properties, context });
	}

	pageLeave(
		properties?: Record<string, unknown>,
		context?: EventContext,
	): void {
		if (!this.isEnabled() || !this.initialized || !this.posthog || !isBrowser())
			return;

		const pageLeaveProperties = {
			...properties,
			...(context?.page && {
				path: context.page.path,
				title: context.page.title,
				referrer: context.page.referrer,
			}),
		} satisfies Properties;

		this.posthog.capture("$pageleave", pageLeaveProperties);
		this.log("Tracked page leave", { properties, context });
	}

	reset(): void {
		if (!this.isEnabled() || !this.initialized || !this.posthog || !isBrowser())
			return;

		this.posthog.reset();
		this.log("Reset user session");
	}
}
