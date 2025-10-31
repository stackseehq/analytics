import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import { isBrowser } from "@/utils/environment.js";

// Bento client-side types - extend as needed from their SDK
interface BentoClient {
	view(): void;
	identify(email: string): void;
	track(event: string, data?: Record<string, unknown>): void;
	tag(tag: string): void;
	updateFields(fields: Record<string, unknown>): void;
	getEmail(): string | null;
	getName(): string | null;
}

// Configuration for Bento client provider
export interface BentoClientConfig {
	/**
	 * Your Bento Site UUID from Account Settings
	 */
	siteUuid: string;
	/**
	 * Enable debug logging
	 */
	debug?: boolean;
	/**
	 * Enable/disable the provider
	 */
	enabled?: boolean;
}

declare global {
	interface Window {
		bento?: BentoClient;
	}
}

export class BentoClientProvider extends BaseAnalyticsProvider {
	name = "Bento-Client";
	private bento?: BentoClient;
	private initialized = false;
	private config: BentoClientConfig;
	private scriptLoaded = false;

	constructor(config: BentoClientConfig) {
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
		if (!this.config.siteUuid || typeof this.config.siteUuid !== "string") {
			throw new Error("Bento requires a siteUuid");
		}

		try {
			// Load Bento script if not already loaded
			if (!this.scriptLoaded) {
				await this.loadBentoScript();
			}

			// Wait for bento to be available
			await this.waitForBento();

			this.bento = window.bento;
			this.initialized = true;

			this.log("Initialized successfully", this.config);
		} catch (error) {
			console.error("[Bento-Client] Failed to initialize:", error);
			throw error;
		}
	}

	private async loadBentoScript(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Check if script is already loaded
			const existingScript = document.querySelector(
				`script[src*="bentonow.com"]`,
			);
			if (existingScript) {
				this.scriptLoaded = true;
				resolve();
				return;
			}

			const script = document.createElement("script");
			script.src = `https://cdn.bentonow.com/v1/${this.config.siteUuid}/bento.js`;
			script.async = true;
			script.onload = () => {
				this.scriptLoaded = true;
				resolve();
			};
			script.onerror = () => {
				reject(new Error("Failed to load Bento script"));
			};

			document.head.appendChild(script);
		});
	}

	private async waitForBento(maxAttempts = 50, interval = 100): Promise<void> {
		for (let i = 0; i < maxAttempts; i++) {
			if (window.bento) {
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, interval));
		}
		throw new Error("Bento SDK not available after loading script");
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.isEnabled() || !this.initialized || !this.bento) return;

		// Bento's identify method expects an email
		const email =
			(traits?.email as string | undefined) || userId;

		this.bento.identify(email);

		// Update additional fields if provided
		if (traits) {
			const fieldsToUpdate = { ...traits };
			// Remove email from fields since it's already set via identify
			delete fieldsToUpdate.email;

			if (Object.keys(fieldsToUpdate).length > 0) {
				this.bento.updateFields(fieldsToUpdate);
			}
		}

		this.log("Identified user", { userId, email, traits });
	}

	track(event: BaseEvent, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.bento) return;

		const data = {
			...event.properties,
			category: event.category,
			timestamp: event.timestamp || Date.now(),
			...(event.userId && { userId: event.userId }),
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
			// Include user email and traits as regular event properties
			...(context?.user?.email && { user_email: context.user.email }),
			...(context?.user?.traits && { user_traits: context.user.traits }),
		};

		this.bento.track(event.action, data);
		this.log("Tracked event", { event, context });
	}

	pageView(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.bento || !isBrowser())
			return;

		// Bento automatically tracks page views, but we'll call view() explicitly
		this.bento.view();

		// Track additional page view data as a custom event if properties provided
		if (properties || context?.page) {
			const data = {
				...properties,
				...(context?.page && {
					path: context.page.path,
					title: context.page.title,
					referrer: context.page.referrer,
				}),
			};

			this.bento.track("$view", data);
		}

		this.log("Tracked page view", { properties, context });
	}

	pageLeave(
		properties?: Record<string, unknown>,
		context?: EventContext,
	): void {
		if (!this.isEnabled() || !this.initialized || !this.bento || !isBrowser())
			return;

		const data = {
			...properties,
			...(context?.page && {
				path: context.page.path,
				title: context.page.title,
				referrer: context.page.referrer,
			}),
		};

		this.bento.track("$pageleave", data);
		this.log("Tracked page leave", { properties, context });
	}

	reset(): void {
		if (!this.isEnabled() || !this.initialized || !this.bento || !isBrowser())
			return;

		// Bento doesn't have a built-in reset method, so we'll clear the identify
		// by identifying with an empty/anonymous user
		this.log("Reset user session - Note: Bento doesn't have a native reset method");
	}
}
