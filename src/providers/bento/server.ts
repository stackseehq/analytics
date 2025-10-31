import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import type { Analytics } from "@bentonow/bento-node-sdk";

// Bento SDK configuration options (matching their internal AnalyticsOptions interface)
export interface BentoAnalyticsOptions {
	/**
	 * Your Bento Site UUID from Team Settings
	 */
	siteUuid: string;
	/**
	 * Authentication credentials
	 */
	authentication: {
		/**
		 * Your Bento Publishable Key from Team Settings
		 */
		publishableKey: string;
		/**
		 * Your Bento Secret Key from Team Settings
		 */
		secretKey: string;
	};
	/**
	 * Optional client configuration
	 */
	clientOptions?: {
		/**
		 * Base URL for the Bento API (optional)
		 */
		baseUrl?: string;
	};
	/**
	 * Whether to log errors (optional)
	 */
	logErrors?: boolean;
}

// Configuration for Bento server provider
export interface BentoServerConfig extends BentoAnalyticsOptions {
	/**
	 * Enable debug logging
	 */
	debug?: boolean;
	/**
	 * Enable/disable the provider
	 */
	enabled?: boolean;
}

export class BentoServerProvider extends BaseAnalyticsProvider {
	name = "Bento-Server";
	private client?: Analytics;
	private initialized = false;
	private config: BentoServerConfig;
	private currentUserEmail?: string;

	constructor(config: BentoServerConfig) {
		super({ debug: config.debug, enabled: config.enabled });
		this.config = config;
	}

	async initialize(): Promise<void> {
		if (!this.isEnabled()) return;
		if (this.initialized) return;

		// Validate config has required fields
		if (
			!this.config.siteUuid ||
			typeof this.config.siteUuid !== "string"
		) {
			throw new Error("Bento requires a siteUuid");
		}
		if (
			!this.config.authentication?.publishableKey ||
			typeof this.config.authentication.publishableKey !== "string"
		) {
			throw new Error("Bento requires authentication.publishableKey");
		}
		if (
			!this.config.authentication?.secretKey ||
			typeof this.config.authentication.secretKey !== "string"
		) {
			throw new Error("Bento requires authentication.secretKey");
		}

		try {
			// Dynamically import the Bento SDK
			// This will be resolved at runtime when the package is installed
			const { Analytics } = await import("@bentonow/bento-node-sdk");

			const { debug, enabled, ...bentoConfig } = this.config;
			this.client = new Analytics(bentoConfig);

			this.initialized = true;
			this.log("Initialized successfully", {
				siteUuid: this.config.siteUuid,
			});
		} catch (error) {
			console.error(
				"[Bento-Server] Failed to initialize. Make sure @bentonow/bento-node-sdk is installed:",
				error,
			);
			throw error;
		}
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Extract email from userId or traits
		const email = (traits?.email as string | undefined) || userId;
		this.currentUserEmail = email;

		// Add subscriber with traits using the V1 API
		const fields = traits ? { ...traits } : {};
		delete fields.email; // Remove email from fields since it's passed separately

		this.client.V1
			.addSubscriber({
				email,
				fields,
			})
			.catch((error) => {
				console.error("[Bento-Server] Failed to identify user:", error);
			});

		this.log("Identified user", { userId, email, traits });
	}

	async track(event: BaseEvent, context?: EventContext): Promise<void> {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Get email from context.user, current user, or userId
		const email =
			context?.user?.email ||
			this.currentUserEmail ||
			(context?.user?.userId as string | undefined) ||
			event.userId ||
			"anonymous@unknown.com";

		const details = {
			...event.properties,
			category: event.category,
			timestamp: event.timestamp || Date.now(),
			...(event.sessionId && { sessionId: event.sessionId }),
			...(context?.page && {
				page: {
					path: context.page.path,
					title: context.page.title,
					referrer: context.page.referrer,
				},
			}),
			...(context?.device && { device: context.device }),
			...(context?.utm && { utm: context.utm }),
		};

		// Add user traits as fields if available
		const fields = context?.user?.traits || {};

		try {
			await this.client.V1.track({
				email,
				type: `$${event.action}`,
				details,
				fields,
			});

			this.log("Tracked event", { event, context });
		} catch (error) {
			console.error("[Bento-Server] Failed to track event:", error);
		}
	}

	pageView(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Get email from context or current user
		const email =
			context?.user?.email || this.currentUserEmail || "anonymous@unknown.com";

		const details = {
			...properties,
			...(context?.page && {
				path: context.page.path,
				title: context.page.title,
				referrer: context.page.referrer,
			}),
		};

		const fields = context?.user?.traits || {};

		this.client.V1
			.track({
				email,
				type: "$view",
				details,
				fields,
			})
			.catch((error) => {
				console.error("[Bento-Server] Failed to track page view:", error);
			});

		this.log("Tracked page view", { properties, context });
	}

	async reset(): Promise<void> {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Clear the current user email
		this.currentUserEmail = undefined;
		this.log("Reset user session");
	}

	async shutdown(): Promise<void> {
		// Bento Node SDK doesn't require explicit shutdown
		// Just clear the reference
		this.client = undefined;
		this.initialized = false;
		this.log("Shutdown complete");
	}
}
