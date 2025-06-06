import type { AnyEventName, AnyEventProperties } from "@/core/events/index.js";
import type {
	AnalyticsConfig,
	AnalyticsProvider,
	BaseEvent,
	EventCategory,
	EventContext,
} from "@/core/events/types.js";

// Default event map type
type DefaultEventMap = Record<string, Record<string, unknown>>;

export class ServerAnalytics<
	TEventMap extends DefaultEventMap = DefaultEventMap,
> {
	private providers: AnalyticsProvider[] = [];
	private config: AnalyticsConfig;
	private initialized = false;

	constructor(config: AnalyticsConfig) {
		this.config = config;
		this.providers = config.providers;
	}

	initialize(): void {
		if (this.initialized) return;

		// Initialize all providers synchronously
		for (const provider of this.providers) {
			provider.initialize();
		}

		this.initialized = true;
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		for (const provider of this.providers) {
			provider.identify(userId, traits);
		}
	}

	async track<TEventName extends keyof TEventMap & string>(
		eventName: TEventName,
		properties: TEventMap[TEventName],
		options?: {
			userId?: string;
			sessionId?: string;
			context?: EventContext;
		},
	): Promise<void> {
		if (!this.initialized) {
			console.warn("[Analytics] Not initialized. Call initialize() first.");
			return;
		}

		const event: BaseEvent = {
			action: eventName,
			category: this.getCategoryFromEventName(eventName),
			properties: properties as Record<string, unknown>,
			timestamp: Date.now(),
			userId: options?.userId,
			sessionId: options?.sessionId,
		};

		const context: EventContext = {
			...this.config.defaultContext,
			...options?.context,
		};

		// Track with all providers in parallel
		const trackPromises = this.providers.map(async (provider) => {
			try {
				await provider.track(event, context);
			} catch (error) {
				// Log error but don't throw - one provider failing shouldn't break others
				console.error(
					`[Analytics] Provider ${provider.name} failed to track event:`,
					error,
				);
			}
		});

		// Wait for all providers to complete
		await Promise.all(trackPromises);
	}

	page(
		properties?: Record<string, unknown>,
		options?: {
			context?: EventContext;
		},
	): void {
		if (!this.initialized) return;

		const context: EventContext = {
			...this.config.defaultContext,
			...options?.context,
		};

		for (const provider of this.providers) {
			provider.page(properties, context);
		}
	}

	async shutdown(): Promise<void> {
		// Shutdown all providers that support it
		const shutdownPromises = this.providers.map((provider) => {
			if ("shutdown" in provider && typeof provider.shutdown === "function") {
				return provider.shutdown();
			}
			return Promise.resolve();
		});

		await Promise.all(shutdownPromises);
	}

	private getCategoryFromEventName(eventName: string): EventCategory {
		// Extract category from event name pattern: category_action
		const parts = eventName.split("_");
		// Only use the first part as category if there's actually an underscore
		if (parts.length > 1 && parts[0]) {
			return parts[0];
		}

		return "engagement"; // Default fallback category
	}
}
