import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import { PostHog, type PostHogOptions } from "posthog-node";

export class PostHogServerProvider extends BaseAnalyticsProvider {
	name = "PostHog-Server";
	private client?: PostHog;
	private initialized = false;
	private config: { apiKey: string } & PostHogOptions;

	constructor(
		config: { apiKey: string } & PostHogOptions & {
				debug?: boolean;
				enabled?: boolean;
			},
	) {
		super({ debug: config.debug, enabled: config.enabled });
		this.config = config;
	}

	initialize(): void {
		if (!this.isEnabled()) return;
		if (this.initialized) return;

		// Validate config has required fields
		if (!this.config.apiKey || typeof this.config.apiKey !== "string") {
			throw new Error("PostHog requires an apiKey");
		}

		try {
			const { apiKey, ...posthogOptions } = this.config;

			this.client = new PostHog(apiKey, {
				host: "https://app.posthog.com",
				flushAt: 20,
				flushInterval: 10000,
				...posthogOptions,
			});

			this.initialized = true;
			this.log("Initialized successfully", this.config);
		} catch (error) {
			console.error("[PostHog-Server] Failed to initialize:", error);
			throw error;
		}
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		this.client.identify({
			distinctId: userId,
			properties: traits,
		});

		this.log("Identified user", { userId, traits });
	}

	track(event: BaseEvent, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		const properties = {
			...event.properties,
			category: event.category,
			timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
			...(event.sessionId && { sessionId: event.sessionId }),
			...(context?.page && {
				$current_url: context.page.path,
				$page_title: context.page.title,
				$referrer: context.page.referrer,
			}),
			...(context?.device && { device: context.device }),
			...(context?.utm && { utm: context.utm }),
			// Include user email and traits as regular event properties
			...(context?.user?.email && { user_email: context.user.email }),
			...(context?.user?.traits && { user_traits: context.user.traits }),
		};

		this.client.capture({
			distinctId: event.userId || context?.user?.userId || "anonymous",
			event: event.action,
			properties,
		});

		this.log("Tracked event", { event, context });
	}

	pageView(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		const pageProperties = {
			...properties,
			...(context?.page && {
				path: context.page.path,
				title: context.page.title,
				referrer: context.page.referrer,
			}),
		};

		this.client.capture({
			distinctId: "anonymous",
			event: "$pageview",
			properties: pageProperties,
		});

		this.log("Tracked page view", { properties, context });
	}

	async reset(): Promise<void> {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Flush any pending events
		await this.client.flush();
		this.log("Flushed pending events");
	}

	async shutdown(): Promise<void> {
		if (this.client) {
			await this.client.shutdown();
			this.log("Shutdown complete");
		}
	}
}
