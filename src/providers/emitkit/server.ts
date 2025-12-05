import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import type { EmitKit } from "@emitkit/js";

/**
 * Configuration for EmitKit server provider
 */
export interface EmitKitServerConfig {
	/**
	 * Your EmitKit API key (starts with emitkit_)
	 */
	apiKey: string;

	/**
	 * Default channel name for events
	 * @default 'general'
	 */
	channelName?: string;

	/**
	 * Map event categories to specific EmitKit channels.
	 * Allows automatic routing of events to appropriate channels based on category.
	 *
	 * @example
	 * ```typescript
	 * {
	 *   'user': 'user-activity',
	 *   'engagement': 'product-usage',
	 *   'error': 'alerts',
	 *   'conversion': 'revenue'
	 * }
	 * ```
	 *
	 * Channel resolution priority:
	 * 1. Event property `__emitkit_channel` (highest priority)
	 * 2. Category mapping via `categoryChannelMap`
	 * 3. Default `channelName` (fallback, default: 'general')
	 */
	categoryChannelMap?: Record<string, string>;

	/**
	 * Send notification for events
	 * @default true
	 */
	notify?: boolean;

	/**
	 * Display style for events
	 * @default 'notification'
	 */
	displayAs?: "message" | "notification";

	/**
	 * Enable debug logging
	 */
	debug?: boolean;

	/**
	 * Enable/disable the provider
	 */
	enabled?: boolean;
}

export class EmitKitServerProvider extends BaseAnalyticsProvider {
	name = "EmitKit-Server";
	private client?: EmitKit;
	private initialized = false;
	private config: EmitKitServerConfig;
	private currentUserId?: string;
	private currentUserEmail?: string;

	constructor(config: EmitKitServerConfig) {
		super({ debug: config.debug, enabled: config.enabled });
		this.config = config;
	}

	async initialize(): Promise<void> {
		if (!this.isEnabled()) return;
		if (this.initialized) return;

		// Validate config has required fields
		if (!this.config.apiKey || typeof this.config.apiKey !== "string") {
			throw new Error("EmitKit requires an apiKey");
		}

		if (!this.config.apiKey.startsWith("emitkit_")) {
			console.warn(
				"[EmitKit-Server] API key should start with 'emitkit_'. Double check your configuration.",
			);
		}

		try {
			// Dynamically import the EmitKit SDK
			const { EmitKit } = await import("@emitkit/js");

			this.client = new EmitKit(this.config.apiKey);

			this.initialized = true;
			this.log("Initialized successfully");
		} catch (error) {
			console.error(
				"[EmitKit-Server] Failed to initialize. Make sure @emitkit/js is installed:",
				error,
			);
			throw error;
		}
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Store for later use in track calls
		this.currentUserId = userId;

		// Extract email from traits
		const email = (traits?.email as string | undefined) || userId;
		if (email?.includes("@")) {
			this.currentUserEmail = email;
		}

		// Build aliases array - EmitKit supports multiple identifiers
		const aliases: string[] = [];

		// Add userId as primary alias
		if (userId) {
			aliases.push(userId);
		}

		// Add email if different from userId
		if (email && email !== userId) {
			aliases.push(email);
		}

		// Add any custom alias fields from traits
		if (traits?.username && typeof traits.username === "string") {
			aliases.push(traits.username);
		}

		// Call EmitKit's identify method
		this.client
			.identify({
				user_id: userId,
				properties: traits || {},
				aliases: aliases.length > 0 ? aliases : undefined,
			})
			.then((result) => {
				this.log("Identified user", {
					userId,
					email,
					identityId: result.data.id,
					aliasesCreated: result.data.aliases?.created?.length || 0,
					aliasesFailed: result.data.aliases?.failed?.length || 0,
				});

				// Log any alias failures
				if (
					result.data.aliases?.failed &&
					result.data.aliases.failed.length > 0
				) {
					console.warn(
						"[EmitKit-Server] Some aliases failed to create:",
						result.data.aliases.failed,
					);
				}
			})
			.catch((error) => {
				console.error("[EmitKit-Server] Failed to identify user:", error);
			});
	}

	async track(event: BaseEvent, context?: EventContext): Promise<void> {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Determine userId - try context.user first, then event, then stored
		const userId =
			context?.user?.email ||
			context?.user?.userId ||
			event.userId ||
			this.currentUserEmail ||
			this.currentUserId;

		// Generate event title from action (convert snake_case to Title Case)
		const title = this.formatEventTitle(event.action);

		// Build metadata from event properties and context
		// Strip __emitkit_channel from properties as it's internal routing metadata
		const { __emitkit_channel, ...cleanProperties } = event.properties || {};

		const metadata: Record<string, unknown> = {
			...cleanProperties,
			category: event.category,
			timestamp: event.timestamp || Date.now(),
			...(event.sessionId && { sessionId: event.sessionId }),
			...(context?.page && {
				page: {
					url: context.page.url,
					host: context.page.host,
					path: context.page.path,
					title: context.page.title,
					protocol: context.page.protocol,
					referrer: context.page.referrer,
					...(context.page.search && { search: context.page.search }),
				},
			}),
			...(context?.device && { device: context.device }),
			...(context?.utm && { utm: context.utm }),
			...(context?.server && { server: context.server }),
		};

		// Extract tags from category
		const tags: string[] = [];
		if (event.category) {
			tags.push(event.category);
		}

		// Add any custom tags from properties
		if (
			cleanProperties?.tags &&
			Array.isArray(cleanProperties.tags) &&
			cleanProperties.tags.every((t) => typeof t === "string")
		) {
			tags.push(...(cleanProperties.tags as string[]));
		}

		// Determine channel name using resolution logic
		const channelName = this.resolveChannelName(event);

		try {
			const result = await this.client.events.create({
				channelName,
				title,
				description: this.getEventDescription(event, context),
				icon: this.getEventIcon(event.category),
				tags: tags.length > 0 ? tags : undefined,
				metadata,
				userId: userId || null,
				notify: this.config.notify ?? true,
				displayAs: this.config.displayAs || "notification",
				source: "stacksee-analytics",
			});

			this.log("Tracked event", {
				eventId: result.data.id,
				action: event.action,
				userId,
				channelName,
			});
		} catch (error) {
			console.error("[EmitKit-Server] Failed to track event:", error);
			throw error;
		}
	}

	pageView(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Determine userId
		const userId =
			context?.user?.email ||
			context?.user?.userId ||
			this.currentUserEmail ||
			this.currentUserId;

		// Strip __emitkit_channel from properties if present
		const { __emitkit_channel, ...cleanProperties } = properties || {};

		// Build page view metadata
		const metadata: Record<string, unknown> = {
			...cleanProperties,
			date: new Date().toISOString(),
			...(context?.page && {
				page: {
					url: context.page.url,
					host: context.page.host,
					path: context.page.path,
					title: context.page.title,
					protocol: context.page.protocol,
					referrer: context.page.referrer,
					...(context.page.search && { search: context.page.search }),
				},
			}),
			...(context?.device && { device: context.device }),
			...(context?.utm && { utm: context.utm }),
			...(context?.server && { server: context.server }),
		};

		// Create a synthetic event for channel resolution
		// Page views use 'navigation' category
		const syntheticEvent: BaseEvent = {
			action: "page_view",
			category: "navigation",
			properties: properties || {},
		};

		// Determine channel name using resolution logic
		const channelName = this.resolveChannelName(syntheticEvent);

		// Create page view event
		this.client.events
			.create({
				channelName,
				title: "Page View",
				description: context?.page?.path || "User viewed a page",
				icon: "👁️",
				tags: ["page_view", "navigation"],
				metadata,
				userId: userId || null,
				notify: false, // Don't notify for page views by default
				displayAs: "message",
				source: "stacksee-analytics",
			})
			.then((result) => {
				this.log("Tracked page view", {
					eventId: result.data.id,
					path: context?.page?.path,
					userId,
					channelName,
				});
			})
			.catch((error) => {
				console.error("[EmitKit-Server] Failed to track page view:", error);
			});
	}

	async reset(): Promise<void> {
		if (!this.isEnabled() || !this.initialized || !this.client) return;

		// Clear stored user context
		this.currentUserId = undefined;
		this.currentUserEmail = undefined;

		this.log("Reset user session");
	}

	async shutdown(): Promise<void> {
		// EmitKit SDK doesn't require explicit shutdown
		// Events are sent immediately (not batched)
		this.client = undefined;
		this.initialized = false;
		this.log("Shutdown complete");
	}

	// ============================================================================
	// Helper Methods
	// ============================================================================

	/**
	 * Format event action into a human-readable title
	 * Converts: "user_signed_up" -> "User Signed Up"
	 */
	private formatEventTitle(action: string): string {
		return action
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	}

	/**
	 * Generate a description for the event
	 */
	private getEventDescription(
		event: BaseEvent,
		context?: EventContext,
	): string | undefined {
		// Use explicit description from properties if available
		if (
			event.properties?.description &&
			typeof event.properties.description === "string"
		) {
			return event.properties.description;
		}

		// Generate default description based on category
		const categoryDescriptions: Record<string, string> = {
			engagement: "User interaction event",
			user: "User lifecycle event",
			navigation: "Navigation event",
			error: "Error or exception occurred",
			performance: "Performance metric",
			conversion: "Conversion event",
		};

		return categoryDescriptions[event.category] || undefined;
	}

	/**
	 * Get an appropriate icon for the event category
	 */
	private getEventIcon(category: string): string | undefined {
		const categoryIcons: Record<string, string> = {
			engagement: "👆",
			user: "👤",
			navigation: "🧭",
			error: "❌",
			performance: "⚡",
			conversion: "💰",
		};

		return categoryIcons[category];
	}

	/**
	 * Resolve the channel name for an event based on priority:
	 * 1. Event property __emitkit_channel (highest priority)
	 * 2. Category mapping via categoryChannelMap
	 * 3. Default channelName (fallback, default: 'general')
	 */
	private resolveChannelName(
		event: BaseEvent,
		defaultChannel?: string,
	): string {
		// Priority 1: Check for explicit channel override in properties
		if (
			event.properties?.__emitkit_channel &&
			typeof event.properties.__emitkit_channel === "string"
		) {
			return event.properties.__emitkit_channel;
		}

		// Priority 2: Check category mapping
		if (this.config.categoryChannelMap && event.category) {
			const mappedChannel = this.config.categoryChannelMap[event.category];
			if (mappedChannel) {
				return mappedChannel;
			}
		}

		// Priority 3: Use default channel
		return defaultChannel || this.config.channelName || "general";
	}
}
