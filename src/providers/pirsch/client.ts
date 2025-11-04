import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import { isBrowser } from "@/utils/environment.js";

// Pirsch client-side types - based on pirsch-sdk/web
interface PirschWebClient {
	hit(data?: {
		url?: string;
		title?: string;
		tags?: Record<string, string | number | boolean>;
	}): Promise<void>;
	event(
		name: string,
		duration?: number,
		meta?: Record<string, unknown>,
	): Promise<void>;
}

// Configuration for Pirsch client provider
export interface PirschClientConfig {
	/**
	 * Your Pirsch identification code from the dashboard
	 * Found in: Settings > Integrations > JavaScript Snippet
	 */
	identificationCode: string;
	/**
	 * The hostname/domain being tracked (e.g., "example.com")
	 */
	hostname?: string;
	/**
	 * Enable debug logging
	 */
	debug?: boolean;
	/**
	 * Enable/disable the provider
	 */
	enabled?: boolean;
}

export class PirschClientProvider extends BaseAnalyticsProvider {
	name = "Pirsch-Client";
	private client?: PirschWebClient;
	private initialized = false;
	private config: PirschClientConfig;

	constructor(config: PirschClientConfig) {
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
		if (
			!this.config.identificationCode ||
			typeof this.config.identificationCode !== "string"
		) {
			throw new Error("Pirsch requires an identificationCode");
		}

		try {
			// Dynamically import the Pirsch SDK
			const { Pirsch } = await import("pirsch-sdk/web");

			this.client = new Pirsch({
				identificationCode: this.config.identificationCode,
				...(this.config.hostname && { hostname: this.config.hostname }),
			});

			this.initialized = true;
			this.log("Initialized successfully", this.config);
		} catch (error) {
			console.error(
				"[Pirsch-Client] Failed to initialize. Make sure pirsch-sdk is installed:",
				error,
			);
			throw error;
		}
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Pirsch doesn't have a native identify method
		// We can track an identification event instead
		this.client
			.event("user_identified", 0, {
				userId,
				...traits,
			})
			.catch((error) => {
				console.error("[Pirsch-Client] Failed to track identify event:", error);
			});

		this.log("Identified user via event", { userId, traits });
	}

	async track(event: BaseEvent, context?: EventContext): Promise<void> {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		const meta = {
			...event.properties,
			category: event.category,
			...(event.userId && { userId: event.userId }),
			...(event.sessionId && { sessionId: event.sessionId }),
			...(context?.page && {
				page_path: context.page.path,
				page_title: context.page.title,
				page_referrer: context.page.referrer,
			}),
			...(context?.device && { device: context.device }),
			...(context?.utm && { utm: context.utm }),
			...(context?.user?.email && { user_email: context.user.email }),
			...(context?.user?.traits && { user_traits: context.user.traits }),
		};

		try {
			// Pirsch event method: event(name, duration, meta)
			// Duration is in seconds, we'll default to 0 for non-duration events
			await this.client.event(event.action, 0, meta);
			this.log("Tracked event", { event, context });
		} catch (error) {
			console.error("[Pirsch-Client] Failed to track event:", error);
		}
	}

	pageView(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.client || !isBrowser())
			return;

		// Build hit data with optional custom data
		// Filter properties to scalar values (string, number, boolean) for tags
		const tags =
			properties &&
			Object.keys(properties).length > 0
				? (Object.fromEntries(
						Object.entries(properties).filter(
							([, v]) =>
								typeof v === "string" ||
								typeof v === "number" ||
								typeof v === "boolean",
						),
					) as Record<string, string | number | boolean>)
				: undefined;

		const hitData = {
			...(context?.page?.url && { url: context.page.url }),
			...(context?.page?.title && { title: context.page.title }),
			...(tags && { tags }),
		};

		// Track page view with tags if available, otherwise just basic hit
		const hit = Object.keys(hitData).length > 0 ? hitData : undefined;

		this.client.hit(hit).catch((error) => {
			console.error("[Pirsch-Client] Failed to track page view:", error);
		});

		this.log("Tracked page view", { properties, context });
	}

	pageLeave(
		properties?: Record<string, unknown>,
		context?: EventContext,
	): void {
		if (!this.isEnabled() || !this.initialized || !this.client || !isBrowser())
			return;

		const meta = {
			...properties,
			...(context?.page && {
				path: context.page.path,
				title: context.page.title,
			}),
		};

		this.client.event("page_leave", 0, meta).catch((error) => {
			console.error("[Pirsch-Client] Failed to track page leave:", error);
		});

		this.log("Tracked page leave", { properties, context });
	}

	reset(): void {
		if (!this.isEnabled() || !this.initialized || !this.client || !isBrowser())
			return;

		// Pirsch doesn't have a built-in reset method
		// Track a session end event
		this.client.event("session_reset", 0, {}).catch((error) => {
			console.error("[Pirsch-Client] Failed to track session reset:", error);
		});

		this.log("Reset user session");
	}
}
