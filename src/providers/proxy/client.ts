import type { BaseEvent, EventContext } from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import type {
	ProxyBatchConfig,
	ProxyEvent,
	ProxyPayload,
	ProxyRetryConfig,
} from "./types.js";

export interface ProxyProviderConfig {
	/**
	 * The endpoint to send events to (e.g., '/api/events')
	 */
	endpoint: string;

	/**
	 * Batching configuration
	 */
	batch?: ProxyBatchConfig;

	/**
	 * Retry configuration
	 */
	retry?: ProxyRetryConfig;

	/**
	 * Custom headers to include in requests
	 */
	headers?: Record<string, string>;

	/**
	 * Enable debug logging
	 */
	debug?: boolean;

	/**
	 * Enable/disable the provider
	 */
	enabled?: boolean;
}

export class ProxyProvider extends BaseAnalyticsProvider {
	name = "Proxy";
	private config: ProxyProviderConfig;
	private queue: ProxyEvent[] = [];
	private flushTimer?: ReturnType<typeof setTimeout>;
	private readonly batchSize: number;
	private readonly batchInterval: number;
	private readonly retryAttempts: number;
	private readonly retryBackoff: "exponential" | "linear";
	private readonly retryInitialDelay: number;

	constructor(config: ProxyProviderConfig) {
		super({ debug: config.debug, enabled: config.enabled });
		this.config = config;
		this.batchSize = config.batch?.size ?? 10;
		this.batchInterval = config.batch?.interval ?? 5000;
		this.retryAttempts = config.retry?.attempts ?? 3;
		this.retryBackoff = config.retry?.backoff ?? "exponential";
		this.retryInitialDelay = config.retry?.initialDelay ?? 1000;

		// Flush on page unload
		if (typeof window !== "undefined") {
			window.addEventListener("beforeunload", () => {
				this.flush(true);
			});

			// Also flush on visibility change (mobile browsers)
			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === "hidden") {
					this.flush(true);
				}
			});
		}
	}

	async initialize(): Promise<void> {
		if (!this.isEnabled()) return;
		this.log("Initialized successfully", { endpoint: this.config.endpoint });
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.isEnabled()) return;

		this.queueEvent({
			type: "identify",
			userId,
			traits,
		});

		this.log("Queued identify event", { userId, traits });
	}

	async track(event: BaseEvent, context?: EventContext): Promise<void> {
		if (!this.isEnabled()) return;

		this.queueEvent({
			type: "track",
			event,
			context: this.enrichContext(context),
		});

		this.log("Queued track event", { event, context });
	}

	pageView(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled()) return;

		this.queueEvent({
			type: "pageView",
			properties,
			context: this.enrichContext(context),
		});

		this.log("Queued page view event", { properties, context });
	}

	async reset(): Promise<void> {
		if (!this.isEnabled()) return;

		this.queueEvent({
			type: "reset",
		});

		this.log("Queued reset event");
	}

	async shutdown(): Promise<void> {
		await this.flush(true);
		this.log("Shutdown complete");
	}

	/**
	 * Manually flush all queued events
	 */
	async flush(useBeacon = false): Promise<void> {
		if (this.queue.length === 0) return;

		const events = [...this.queue];
		this.queue = [];

		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = undefined;
		}

		await this.sendEvents(events, useBeacon);
	}

	private queueEvent(event: ProxyEvent): void {
		this.queue.push(event);

		// Auto-flush if batch size reached
		if (this.queue.length >= this.batchSize) {
			this.flush().catch((error) => {
				console.error("[Proxy] Failed to flush events:", error);
			});
			return;
		}

		// Schedule flush if not already scheduled
		if (!this.flushTimer) {
			this.flushTimer = setTimeout(() => {
				this.flush().catch((error) => {
					console.error("[Proxy] Failed to flush events:", error);
				});
			}, this.batchInterval);
		}
	}

	private async sendEvents(
		events: ProxyEvent[],
		useBeacon = false,
	): Promise<void> {
		const payload: ProxyPayload = { events };

		if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
			// Use beacon for page unload (more reliable)
			const blob = new Blob([JSON.stringify(payload)], {
				type: "application/json",
			});
			const sent = navigator.sendBeacon(this.config.endpoint, blob);
			if (!sent) {
				console.warn("[Proxy] Failed to send events via beacon");
			}
			return;
		}

		// Regular fetch with retry
		await this.sendWithRetry(payload);
	}

	private async sendWithRetry(
		payload: ProxyPayload,
		attempt = 0,
	): Promise<void> {
		try {
			const response = await fetch(this.config.endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...this.config.headers,
				},
				body: JSON.stringify(payload),
				// Don't include credentials by default
				credentials: "same-origin",
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			this.log(`Sent ${payload.events.length} events successfully`);
		} catch (error) {
			if (attempt < this.retryAttempts) {
				const delay = this.calculateRetryDelay(attempt);
				this.log(`Retry attempt ${attempt + 1} after ${delay}ms`, { error });

				await new Promise((resolve) => setTimeout(resolve, delay));
				return this.sendWithRetry(payload, attempt + 1);
			}

			console.error("[Proxy] Failed to send events after retries:", error);
			throw error;
		}
	}

	private calculateRetryDelay(attempt: number): number {
		if (this.retryBackoff === "exponential") {
			return this.retryInitialDelay * 2 ** attempt;
		}
		return this.retryInitialDelay * (attempt + 1);
	}

	private enrichContext(context?: EventContext): EventContext {
		if (typeof window === "undefined") return context || {};

		return {
			...context,
			page: {
				path: window.location.pathname,
				title: document.title,
				referrer: document.referrer,
				...context?.page,
				// Additional fields for proxy (cast to any to bypass strict typing)
				// biome-ignore lint/suspicious/noExplicitAny: Extended page context fields not in base type
				...({ url: window.location.href } as any),
			},
			user: {
				...context?.user,
			},
			device: {
				...context?.device,
				// Additional fields for proxy (cast to any to bypass strict typing)
				// biome-ignore lint/suspicious/noExplicitAny: Extended device context fields not in base type
				...(({
					userAgent: navigator.userAgent,
					language: navigator.language,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					screen: {
						width: window.screen.width,
						height: window.screen.height,
					},
					viewport: {
						width: window.innerWidth,
						height: window.innerHeight,
					},
				}) as any),
			},
		};
	}
}
