import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import { isBrowser } from "@/utils/environment.js";

// Pirsch global function type — exposed by pa.js
type PirschFn = (
	eventName: string,
	options?: {
		duration?: number;
		meta?: Record<string, string>;
		non_interactive?: boolean;
	},
) => Promise<void>;

declare global {
	interface Window {
		pirsch?: PirschFn;
	}
}

export interface PirschClientConfig {
	/**
	 * Your Pirsch identification code from the dashboard.
	 * Found in: Settings > Integration > JavaScript Snippet → data-code
	 */
	identificationCode: string;
	/**
	 * Override the hostname tracked (optional).
	 * Defaults to the current page hostname.
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
	private initialized = false;
	private initPromise: Promise<void> | null = null;
	private config: PirschClientConfig;
	private scriptLoaded = false;

	constructor(config: PirschClientConfig) {
		super({ debug: config.debug, enabled: config.enabled });
		this.config = config;
	}

	async initialize(): Promise<void> {
		if (!this.isEnabled()) return;
		if (this.initPromise) return this.initPromise;
		this.initPromise = this._doInitialize();
		return this.initPromise;
	}

	private async _doInitialize(): Promise<void> {
		if (!isBrowser()) {
			this.log("Skipping initialization - not in browser environment");
			return;
		}

		if (
			!this.config.identificationCode ||
			typeof this.config.identificationCode !== "string"
		) {
			this.initPromise = null;
			throw new Error("Pirsch requires an identificationCode");
		}

		try {
			if (!this.scriptLoaded) {
				await this.loadScript();
			}
			await this.waitForPirsch();
			this.initialized = true;
			this.log("Initialized successfully", this.config);
		} catch (error) {
			this.initPromise = null;
			console.error("[Pirsch-Client] Failed to initialize:", error);
			throw error;
		}
	}

	private async loadScript(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Skip if already injected
			if (document.getElementById("pianjs")) {
				this.scriptLoaded = true;
				resolve();
				return;
			}

			const script = document.createElement("script");
			script.src = "https://api.pirsch.io/pa.js";
			script.id = "pianjs";
			script.defer = true;
			script.setAttribute("data-code", this.config.identificationCode);
			if (this.config.hostname) {
				script.setAttribute("data-hostname", this.config.hostname);
			}
			script.onload = () => {
				this.scriptLoaded = true;
				resolve();
			};
			script.onerror = () => {
				reject(new Error("Failed to load Pirsch script from api.pirsch.io"));
			};
			document.head.appendChild(script);
		});
	}

	private async waitForPirsch(maxAttempts = 50, interval = 100): Promise<void> {
		for (let i = 0; i < maxAttempts; i++) {
			if (typeof window.pirsch === "function") return;
			await new Promise((resolve) => setTimeout(resolve, interval));
		}
		throw new Error("Pirsch global function not available after loading script");
	}

	identify(_userId: string, _traits?: Record<string, unknown>): void {
		// Pirsch does not support user identification client-side
		this.log("Identify is not supported by the Pirsch client provider");
	}

	async track(event: BaseEvent, context?: EventContext): Promise<void> {
		if (!this.isEnabled() || !this.initialized || !window.pirsch) return;

		// Pirsch event_meta only accepts string values
		const meta: Record<string, string> = {};

		if (event.properties) {
			for (const [key, value] of Object.entries(event.properties)) {
				if (value !== null && value !== undefined) {
					meta[key] = String(value);
				}
			}
		}
		if (event.category) meta.category = event.category;
		if (context?.page?.path) meta.page_path = context.page.path;

		try {
			await window.pirsch(
				event.action,
				Object.keys(meta).length > 0 ? { meta } : undefined,
			);
			this.log("Tracked event", { event, context });
		} catch (error) {
			console.error("[Pirsch-Client] Failed to track event:", error);
		}
	}

	pageView(_properties?: Record<string, unknown>, _context?: EventContext): void {
		// Pirsch pa.js handles page views automatically on script load
		this.log("Page view — handled automatically by Pirsch pa.js");
	}

	pageLeave(_properties?: Record<string, unknown>, _context?: EventContext): void {
		// Pirsch pa.js handles page leave automatically
		this.log("Page leave — handled automatically by Pirsch pa.js");
	}

	reset(): void {
		this.log("Reset — Pirsch does not have a native session reset method");
	}
}
