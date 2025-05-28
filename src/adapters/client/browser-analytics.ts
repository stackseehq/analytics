import type { AnyEventName, AnyEventProperties } from "@/core/events/index.js";
import type {
	AnalyticsConfig,
	AnalyticsProvider,
	BaseEvent,
	EventCategory,
	EventContext,
} from "@/core/events/types.js";

export class BrowserAnalytics<
	TEventName extends string = AnyEventName,
	TEventProperties extends Record<string, unknown> = AnyEventProperties,
> {
	private providers: AnalyticsProvider[] = [];
	private context: EventContext = {};
	private userId?: string;
	private sessionId?: string;
	private initialized = false;

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

	identify(userId: string, traits?: Record<string, unknown>): void {
		this.userId = userId;
		for (const provider of this.providers) {
			provider.identify(userId, traits);
		}
	}

	track(eventName: TEventName, properties: TEventProperties): void {
		if (!this.initialized) {
			console.warn("[Analytics] Not initialized. Call initialize() first.");
			return;
		}

		const event: BaseEvent = {
			action: eventName,
			category: this.getCategoryFromEventName(eventName),
			properties: properties as Record<string, unknown>,
			timestamp: Date.now(),
			userId: this.userId,
			sessionId: this.sessionId,
		};

		for (const provider of this.providers) {
			provider.track(event, this.context);
		}
	}

	page(properties?: Record<string, unknown>): void {
		if (!this.initialized) return;

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
			campaign: {
				...this.context.campaign,
				...context.campaign,
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
