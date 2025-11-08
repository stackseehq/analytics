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

		// Check if using access key (starts with "pa_") or OAuth (requires clientId)
		const isAccessKey = this.config.clientSecret.startsWith("pa_");
		if (!isAccessKey && !this.config.clientId) {
			throw new Error(
				"Pirsch requires a clientId when using OAuth authentication (clientSecret doesn't start with 'pa_'). " +
				"Either provide a clientId or use an access key (starts with 'pa_') as clientSecret.",
			);
		}

		try {
			// Dynamically import the Pirsch SDK
			const { Pirsch } = await import("pirsch-sdk");

			const { debug, enabled, ...pirschConfig } = this.config;
			this.client = new Pirsch(pirschConfig);

			this.initialized = true;
			this.log("Initialized successfully", {
				hostname: this.config.hostname,
				authMode: isAccessKey ? "access-key" : "oauth",
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
		// Note: identify() doesn't receive context, so we use dummy values
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

		// Extract IP and user-agent from enriched context (set by proxy handler)
		// biome-ignore lint/suspicious/noExplicitAny: Extended context fields from proxy handler
		const extendedContext = context as any;
		const ip = extendedContext?.device?.ip || extendedContext?.server?.ip;
		const userAgent =
			extendedContext?.server?.userAgent || extendedContext?.device?.userAgent;

		// Skip tracking if we don't have valid IP or user-agent
		// Pirsch requires real browser data, not dummy values
		if (!ip || !userAgent) {
			this.log("Skipping event - missing required IP or user-agent from context", {
				hasIp: !!ip,
				hasUserAgent: !!userAgent,
				event: event.action,
			});
			return;
		}

		// Build full URL (Pirsch requires full URLs, not just paths)
		const url =
			context?.page?.url ||
			(context?.page?.protocol &&
			context?.page?.host &&
			context?.page?.path
				? `${context.page.protocol}://${context.page.host}${context.page.path}`
				: context?.page?.path
					? `https://${this.config.hostname}${context.page.path}`
					: "https://event");

		// Build hit data - URL, IP, and User-Agent are required
		const hit: PirschHit = {
			url,
			ip,
			user_agent: userAgent,
			...(context?.page?.title && { title: context.page.title }),
			...(context?.page?.referrer && { referrer: context.page.referrer }),
			...(context?.device?.screen?.width && { screen_width: context.device.screen.width }),
			...(context?.device?.screen?.height && { screen_height: context.device.screen.height }),
			...(context?.device?.viewport?.width && { sec_ch_viewport_width: String(context.device.viewport.width) }),
			...(context?.device?.language && { accept_language: context.device.language }),
			...(context?.device?.type && { sec_ch_ua_mobile: context.device.type === 'mobile' || context.device.type === 'tablet' ? '?1' : '?0' }),
			...(context?.device?.os && { sec_ch_ua_platform: context.device.os }),
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
			...(context?.device?.timezone && { timezone: context.device.timezone }),
			...(context?.device?.browser && { browser: context.device.browser }),
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

		// Extract IP and user-agent from enriched context (set by proxy handler)
		// biome-ignore lint/suspicious/noExplicitAny: Extended context fields from proxy handler
		const extendedContext = context as any;
		const ip = extendedContext?.device?.ip || extendedContext?.server?.ip;
		const userAgent =
			extendedContext?.server?.userAgent || extendedContext?.device?.userAgent;

		// Skip tracking if we don't have valid IP or user-agent
		// Pirsch requires real browser data, not dummy values
		if (!ip || !userAgent) {
			this.log("Skipping pageView - missing required IP or user-agent from context", {
				hasIp: !!ip,
				hasUserAgent: !!userAgent,
			});
			return;
		}

		// Build full URL (Pirsch requires full URLs, not just paths)
		const url =
			context?.page?.url ||
			(context?.page?.protocol &&
			context?.page?.host &&
			context?.page?.path
				? `${context.page.protocol}://${context.page.host}${context.page.path}`
				: context?.page?.path
					? `https://${this.config.hostname}${context.page.path}`
					: "https://pageview");

		// Build hit data - URL, IP, and User-Agent are required
		const hit: PirschHit = {
			url,
			ip,
			user_agent: userAgent,
			...(context?.page?.title && { title: context.page.title }),
			...(context?.page?.referrer && { referrer: context.page.referrer }),
			...(context?.device?.screen?.width && { screen_width: context.device.screen.width }),
			...(context?.device?.screen?.height && { screen_height: context.device.screen.height }),
			...(context?.device?.viewport?.width && { sec_ch_viewport_width: String(context.device.viewport.width) }),
			...(context?.device?.language && { accept_language: context.device.language }),
			...(context?.device?.type && { sec_ch_ua_mobile: context.device.type === 'mobile' || context.device.type === 'tablet' ? '?1' : '?0' }),
			...(context?.device?.os && { sec_ch_ua_platform: context.device.os }),
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
