import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import { isBrowser } from "@/utils/environment.js";

// visitors.now client-side types
interface VisitorsClient {
	track(event: string, properties?: Record<string, string | number>): void;
	identify(traits: {
		id: string;
		email?: string;
		name?: string;
		[key: string]: string | number | undefined;
	}): void;
}

export interface VisitorsClientConfig {
	/**
	 * Your Visitors project token from the dashboard
	 */
	token: string;
	/**
	 * Enable debug logging
	 */
	debug?: boolean;
	/**
	 * Enable/disable the provider
	 */
	enabled?: boolean;
	/**
	 * Enable persist mode. Sets the `data-persist` attribute on the Visitors
	 * script tag so the visitor cookie is written, enabling cross-session
	 * tracking and Stripe revenue attribution via `getVisitorId()`.
	 */
	persist?: boolean;
}

declare global {
	interface Window {
		visitors?: VisitorsClient;
	}
}

export class VisitorsClientProvider extends BaseAnalyticsProvider {
	name = "Visitors-Client";
	private visitors?: VisitorsClient;
	private initialized = false;
	/**
	 * Shared Promise for any in-flight initialization. Concurrent calls to
	 * initialize() all await the same Promise, preventing the race condition
	 * where multiple callers each inject the script and trigger duplicate
	 * automatic page-view events (→ 429 from visitors.now).
	 */
	private initPromise: Promise<void> | null = null;
	private config: VisitorsClientConfig;
	private scriptLoaded = false;
	/** Last user ID passed to identify(), used to deduplicate repeated calls. */
	private lastIdentifiedUserId: string | null = null;

	constructor(config: VisitorsClientConfig) {
		super({ debug: config.debug, enabled: config.enabled });
		this.config = config;
	}

	async initialize(): Promise<void> {
		if (!this.isEnabled()) return;
		// Return the existing Promise if initialization is already in-flight or done.
		// This is the critical fix: a boolean flag is only set AFTER the async work
		// completes, so concurrent callers all pass the boolean check and each
		// trigger a separate script load + automatic page-view POST.
		if (this.initPromise) return this.initPromise;

		this.initPromise = this._doInitialize();
		return this.initPromise;
	}

	private async _doInitialize(): Promise<void> {
		if (!isBrowser()) {
			this.log("Skipping initialization - not in browser environment");
			return;
		}

		if (!this.config.token || typeof this.config.token !== "string") {
			// Reset so a corrected config can retry
			this.initPromise = null;
			throw new Error("Visitors requires a token");
		}

		try {
			if (!this.scriptLoaded) {
				await this.loadScript();
			}

			await this.waitForVisitors();

			this.visitors = window.visitors;
			this.initialized = true;
			this.log("Initialized successfully", this.config);
		} catch (error) {
			// Allow a future retry after transient failures (e.g. network error)
			this.initPromise = null;
			console.error("[Visitors-Client] Failed to initialize:", error);
			throw error;
		}
	}

	private async loadScript(): Promise<void> {
		return new Promise((resolve, reject) => {
			const existingScript = document.querySelector(
				`script[src*="cdn.visitors.now"]`,
			);
			if (existingScript) {
				this.scriptLoaded = true;
				resolve();
				return;
			}

			const script = document.createElement("script");
			script.src = "https://cdn.visitors.now/v.js";
			script.setAttribute("data-token", this.config.token);
			if (this.config.persist) {
				script.setAttribute("data-persist", "");
			}
			script.async = true;
			script.defer = true;
			script.onload = () => {
				this.scriptLoaded = true;
				resolve();
			};
			script.onerror = () => {
				reject(new Error("Failed to load Visitors script"));
			};

			document.head.appendChild(script);
		});
	}

	private async waitForVisitors(
		maxAttempts = 50,
		interval = 100,
	): Promise<void> {
		for (let i = 0; i < maxAttempts; i++) {
			if (window.visitors) {
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, interval));
		}
		throw new Error("Visitors SDK not available after loading script");
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.isEnabled() || !this.initialized || !this.visitors) return;

		// Deduplicate: skip if the same user ID was already sent in this session.
		// Without this, calling identify() on every route change (a common pattern
		// in Next.js layouts) hammers e.visitors.now/e and triggers 429s.
		if (this.lastIdentifiedUserId === userId) {
			this.log("Identify skipped — already identified this session", { userId });
			return;
		}

		const payload: {
			id: string;
			email?: string;
			name?: string;
			[key: string]: string | number | undefined;
		} = { id: userId };

		if (traits) {
			for (const [key, value] of Object.entries(traits)) {
				if (typeof value === "string" || typeof value === "number") {
					payload[key] = value;
				}
			}
		}

		this.visitors.identify(payload);
		this.lastIdentifiedUserId = userId;
		this.log("Identified user", { userId, traits });
	}

	track(event: BaseEvent, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized || !this.visitors) return;

		const properties: Record<string, string | number> = {};

		if (event.properties) {
			for (const [key, value] of Object.entries(event.properties)) {
				if (typeof value === "string" || typeof value === "number") {
					properties[key] = value;
				}
			}
		}

		if (event.category) {
			properties.category = event.category;
		}

		if (context?.page?.path) {
			properties.page_path = context.page.path;
		}

		if (context?.page?.title) {
			properties.page_title = context.page.title;
		}

		this.visitors.track(event.action, properties);
		this.log("Tracked event", { event, context });
	}

	pageView(properties?: Record<string, unknown>, context?: EventContext): void {
		// visitors.now tracks page views automatically via the script tag.
		// No explicit call needed, but we can track a custom event if desired.
		this.log("Page view - handled automatically by Visitors script", {
			properties,
			context,
		});
	}

	pageLeave(
		properties?: Record<string, unknown>,
		context?: EventContext,
	): void {
		if (!this.isEnabled() || !this.initialized || !this.visitors || !isBrowser())
			return;

		const props: Record<string, string | number> = {};

		if (context?.page?.path) {
			props.page_path = context.page.path;
		}

		if (properties) {
			for (const [key, value] of Object.entries(properties)) {
				if (typeof value === "string" || typeof value === "number") {
					props[key] = value;
				}
			}
		}

		this.visitors.track("page_leave", props);
		this.log("Tracked page leave", { properties, context });
	}

	reset(): void {
		if (!this.isEnabled() || !this.initialized || !this.visitors || !isBrowser())
			return;

		// visitors.now doesn't expose a native reset method
		this.log("Reset user session - Note: Visitors does not have a native reset method");
	}

	// ============================================================================
	// Stripe Revenue Attribution
	// ============================================================================

	/**
	 * Returns the current visitor ID from the `visitor` cookie set by the
	 * visitors.now script. Pass this value in your Stripe checkout session
	 * metadata so revenue is attributed to the correct visitor.
	 *
	 * Requires persist mode to be enabled in your visitors.now project settings.
	 *
	 * @example Server-side Stripe checkout creation:
	 * ```typescript
	 * // Client-side: get visitor ID and send to your server
	 * const visitorId = visitorsProvider.getVisitorId();
	 *
	 * // Server-side: include in Stripe checkout session
	 * const session = await stripe.checkout.sessions.create({
	 *   // ...
	 *   metadata: { visitor: visitorId },
	 * });
	 * ```
	 */
	getVisitorId(): string | null {
		if (!isBrowser()) return null;

		const match = document.cookie
			.split("; ")
			.find((row) => row.startsWith("visitor="));

		return match ? decodeURIComponent(match.split("=")[1]) : null;
	}
}
