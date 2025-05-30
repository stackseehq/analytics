import type {
	AnalyticsConfig,
	AnalyticsProvider,
	BaseEvent,
	EventCategory,
	EventContext,
} from "@/core/events/types.js";

// Default event map type
type DefaultEventMap = Record<string, Record<string, unknown>>;

export class BrowserAnalytics<
	TEventMap extends DefaultEventMap = DefaultEventMap,
> {
	private providers: AnalyticsProvider[] = [];
	private context: EventContext = {};
	private userId?: string;
	private sessionId?: string;
	private initialized = false;
	private initializePromise?: Promise<void>;

	constructor(config: AnalyticsConfig) {
		this.providers = config.providers;

		// Set default context
		if (config.defaultContext) {
			this.context = { ...config.defaultContext };
		}

		// Generate session ID
		this.sessionId = this.generateSessionId();
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		// If already initializing, return the existing promise
		if (this.initializePromise) return this.initializePromise;

		this.initializePromise = this._doInitialize();
		return this.initializePromise;
	}

	private async _doInitialize(): Promise<void> {
		// Initialize all providers
		const initPromises = this.providers.map((provider) =>
			provider.initialize(),
		);

		await Promise.all(initPromises);
		this.initialized = true;

		// Set browser context
		this.updateContext({
			page: {
				path: window.location.pathname,
				title: document.title,
				referrer: document.referrer,
			},
			device: {
				type: this.getDeviceType(),
				os: this.getOS(),
				browser: this.getBrowser(),
			},
		});
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized && !this.initializePromise) {
			await this.initialize();
		} else if (this.initializePromise) {
			await this.initializePromise;
		}
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		this.userId = userId;

		// Run initialization if needed, but don't block
		this.ensureInitialized().catch((error) => {
			console.error("[Analytics] Failed to initialize during identify:", error);
		});

		for (const provider of this.providers) {
			provider.identify(userId, traits);
		}
	}

	async track<TEventName extends keyof TEventMap & string>(
		eventName: TEventName,
		properties: TEventMap[TEventName],
	): Promise<void> {
		// Ensure initialization but don't block the track call
		await this.ensureInitialized();

		const event: BaseEvent = {
			action: eventName,
			category: this.getCategoryFromEventName(eventName),
			properties: properties as Record<string, unknown>,
			timestamp: Date.now(),
			userId: this.userId,
			sessionId: this.sessionId,
		};

		// Track with all providers in parallel
		const trackPromises = this.providers.map(async (provider) => {
			try {
				await provider.track(event, this.context);
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

	page(properties?: Record<string, unknown>): void {
		// Run initialization if needed, but don't block
		this.ensureInitialized().catch((error) => {
			console.error("[Analytics] Failed to initialize during page:", error);
		});

		// Update page context
		this.updateContext({
			page: {
				path: window.location.pathname,
				title: document.title,
				referrer: document.referrer,
			},
		});

		for (const provider of this.providers) {
			provider.page(properties, this.context);
		}
	}

	reset(): void {
		this.userId = undefined;
		this.sessionId = this.generateSessionId();
		for (const provider of this.providers) {
			provider.reset();
		}
	}

	updateContext(context: Partial<EventContext>): void {
		this.context = {
			...this.context,
			...context,
			page: context.page
				? {
						path:
							context.page.path ||
							this.context.page?.path ||
							window.location.pathname,
						title: context.page.title || this.context.page?.title,
						referrer: context.page.referrer || this.context.page?.referrer,
					}
				: this.context.page,
			device: {
				...this.context.device,
				...context.device,
			},
			utm: {
				...this.context.utm,
				...context.utm,
			},
		};
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

	private generateSessionId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	private getDeviceType(): string {
		const userAgent = navigator.userAgent;
		if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
			return "tablet";
		}
		if (
			/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(
				userAgent,
			)
		) {
			return "mobile";
		}
		return "desktop";
	}

	private getOS(): string {
		const userAgent = navigator.userAgent;
		if (userAgent.indexOf("Win") !== -1) return "Windows";
		if (userAgent.indexOf("Mac") !== -1) return "macOS";
		if (userAgent.indexOf("Linux") !== -1) return "Linux";
		if (userAgent.indexOf("Android") !== -1) return "Android";
		if (userAgent.indexOf("iOS") !== -1) return "iOS";
		return "Unknown";
	}

	private getBrowser(): string {
		const userAgent = navigator.userAgent;
		if (userAgent.indexOf("Chrome") !== -1) return "Chrome";
		if (userAgent.indexOf("Safari") !== -1) return "Safari";
		if (userAgent.indexOf("Firefox") !== -1) return "Firefox";
		if (userAgent.indexOf("Edge") !== -1) return "Edge";
		return "Unknown";
	}
}
