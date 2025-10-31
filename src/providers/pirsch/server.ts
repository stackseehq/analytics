import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import type {
	PirschNodeApiClient,
	PirschHit,
	PirschProxyHeader,
	Protocol,
	Scalar,
} from "pirsch-sdk";

// Pirsch server configuration options
export interface PirschServerConfig {
	/**
	 * The hostname/domain being tracked (required)
	 * Example: "example.com"
	 */
	hostname: string;
	/**
	 * Protocol to use (default: "https")
	 */
	protocol?: Protocol;
	/**
	 * Client ID for OAuth authentication
	 * Required if not using access key
	 */
	clientId?: string;
	/**
	 * Client secret or access key for authentication
	 * Access keys start with "pa_"
	 */
	clientSecret: string;
	/**
	 * Trusted proxy headers for IP extraction
	 */
	trustedProxyHeaders?: PirschProxyHeader[];
	/**
	 * Enable debug logging
	 */
	debug?: boolean;
	/**
	 * Enable/disable the provider
	 */
	enabled?: boolean;
}

export class PirschServerProvider extends BaseAnalyticsProvider {
	name = "Pirsch-Server";
	private client?: PirschNodeApiClient;
	private initialized = false;
	private config: PirschServerConfig;

	constructor(config: PirschServerConfig) {
		super({ debug: config.debug, enabled: config.enabled });
		this.config = config;
	}

	async initialize(): Promise<void> {
		if (!this.isEnabled()) return;
		if (this.initialized) return;

		// Validate config has required fields
		if (!this.config.hostname || typeof this.config.hostname !== "string") {
			throw new Error("Pirsch requires a hostname");
		}
		if (
			!this.config.clientSecret ||
			typeof this.config.clientSecret !== "string"
		) {
			throw new Error("Pirsch requires a clientSecret (or access key)");
		}

		try {
			// Dynamically import the Pirsch SDK
			const { Pirsch } = await import("pirsch-sdk");

			const { debug, enabled, ...pirschConfig } = this.config;
			this.client = new Pirsch(pirschConfig);

			this.initialized = true;
			this.log("Initialized successfully", {
				hostname: this.config.hostname,
			});
		} catch (error) {
			console.error(
				"[Pirsch-Server] Failed to initialize. Make sure pirsch-sdk is installed:",
				error,
			);
			throw error;
		}
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Pirsch doesn't have a native identify method
		// We can track an identification event instead with minimal hit data
		const hit: PirschHit = {
			url: "https://identify",
			ip: "0.0.0.0",
			user_agent: "analytics-library",
		};

		const meta: Record<string, Scalar> = {
			userId,
			...(traits &&
				Object.fromEntries(
					Object.entries(traits).filter(
						([, v]) =>
							typeof v === "string" ||
							typeof v === "number" ||
							typeof v === "boolean",
					),
				)),
		};

		this.client.event("user_identified", hit, 0, meta).catch((error) => {
			console.error("[Pirsch-Server] Failed to track identify event:", error);
		});

		this.log("Identified user via event", { userId, traits });
	}

	async track(event: BaseEvent, context?: EventContext): Promise<void> {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Build hit data - URL, IP, and User-Agent are required
		const hit: PirschHit = {
			url: context?.page?.path || "https://event",
			ip: "0.0.0.0", // Server-side should provide real IP if available
			user_agent: "analytics-library", // Server-side should provide real UA if available
			...(context?.page?.title && { title: context.page.title }),
			...(context?.page?.referrer && { referrer: context.page.referrer }),
		};

		// Filter properties to only include scalar values (string, number, boolean)
		const scalarProps: Record<string, Scalar> = Object.fromEntries(
			Object.entries(event.properties).filter(
				([, v]) =>
					typeof v === "string" ||
					typeof v === "number" ||
					typeof v === "boolean",
			),
		) as Record<string, Scalar>;

		const meta: Record<string, Scalar> = {
			...scalarProps,
			category: event.category,
			timestamp: String(event.timestamp || Date.now()),
			...(event.userId && { userId: event.userId }),
			...(event.sessionId && { sessionId: event.sessionId }),
			...(context?.user?.email && { user_email: context.user.email }),
		};

		try {
			// Pirsch event method: event(name, hit, duration, meta)
			await this.client.event(event.action, hit, 0, meta);
			this.log("Tracked event", { event, context });
		} catch (error) {
			console.error("[Pirsch-Server] Failed to track event:", error);
		}
	}

	pageView(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Build hit data - URL, IP, and User-Agent are required
		const hit: PirschHit = {
			url: context?.page?.path || "https://pageview",
			ip: "0.0.0.0", // Server-side should provide real IP if available
			user_agent: "analytics-library", // Server-side should provide real UA if available
			...(context?.page?.title && { title: context.page.title }),
			...(context?.page?.referrer && { referrer: context.page.referrer }),
			...(properties && {
				tags: Object.fromEntries(
					Object.entries(properties).filter(
						([, v]) =>
							typeof v === "string" ||
							typeof v === "number" ||
							typeof v === "boolean",
					),
				) as Record<string, Scalar>,
			}),
		};

		this.client.hit(hit).catch((error) => {
			console.error("[Pirsch-Server] Failed to track page view:", error);
		});

		this.log("Tracked page view", { properties, context });
	}

	async reset(): Promise<void> {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Track session end event with minimal hit data
		const hit: PirschHit = {
			url: "https://session-reset",
			ip: "0.0.0.0",
			user_agent: "analytics-library",
		};

		await this.client.event("session_reset", hit, 0, {}).catch((error) => {
			console.error("[Pirsch-Server] Failed to track session reset:", error);
		});

		this.log("Reset user session");
	}

	async shutdown(): Promise<void> {
		// Pirsch SDK doesn't require explicit shutdown
		// Just clear the reference
		this.client = undefined;
		this.initialized = false;
		this.log("Shutdown complete");
	}
}
