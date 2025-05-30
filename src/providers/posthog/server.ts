import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import type { PostHogConfig } from "@/providers/posthog/types.js";
import { PostHog } from "posthog-node";

export class PostHogServerProvider extends BaseAnalyticsProvider {
	name = "PostHog-Server";
	private client?: PostHog;
	private initialized = false;
	private config: PostHogConfig;

	constructor(config: PostHogConfig & { debug?: boolean; enabled?: boolean }) {
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
			this.client = new PostHog(this.config.apiKey, {
				host: this.config.host || "https://app.posthog.com",
				flushAt: 20,
				flushInterval: 10000,
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
		};

		this.client.capture({
			distinctId: event.userId || "anonymous",
			event: event.action,
			properties,
		});

		this.log("Tracked event", { event, context });
	}

	page(properties?: Record<string, unknown>, context?: EventContext): void {
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
