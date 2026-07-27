import type {
	BaseEvent,
	EventContext,
	TrackInvocation,
} from "@/core/events/types.js";
import { BaseAnalyticsProvider } from "@/providers/base.provider.js";
import type {
	ProxyBatchConfig,
	ProxyClientContext,
	ProxyEventV2,
	ProxyPayloadV2,
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
	private queue: ProxyEventV2[] = [];
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
		this.batchInterval = config.batch?.interval ?? 2000;
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

	async track(
		event: BaseEvent,
		context?: EventContext,
		invocation?: TrackInvocation,
	): Promise<void> {
		if (!this.isEnabled()) return;
		if (!invocation) {
			throw new Error(
				"ProxyProvider.track must be called through BrowserAnalytics so raw event input is available",
			);
		}

		this.queueEvent({
			type: "track",
			name: event.action,
			input: invocation.input,
			inputProvided: invocation.inputProvided,
			occurredAt: invocation.occurredAt,
			sessionId: event.sessionId,
			context: this.sanitizeClientContext(context),
		});

		this.log("Queued track event", { event, context });
	}

	pageView(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled()) return;

		this.queueEvent({
			type: "pageView",
			properties,
			occurredAt: Date.now(),
			context: this.sanitizeClientContext(context),
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

	private queueEvent(event: ProxyEventV2): void {
		this.queue.push(event);

		// Auto-flush if batch size reached
		if (this.queue.length >= this.batchSize) {
			this.flush().catch((error) => {
				console.error("[Proxy] Failed to flush events:", error);
			});
			return;
		}

		// Clear existing timer and schedule a new one
		// This ensures the timer always fires batchInterval ms after the LAST event
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
		}

		this.flushTimer = setTimeout(() => {
			this.flush().catch((error) => {
				console.error("[Proxy] Failed to flush events:", error);
			});
		}, this.batchInterval);
	}

	private async sendEvents(
		events: ProxyEventV2[],
		useBeacon = false,
	): Promise<void> {
		const payload: ProxyPayloadV2 = { version: 2, events };

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
		payload: ProxyPayloadV2,
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

	private sanitizeClientContext(context?: EventContext): ProxyClientContext {
		const browser = typeof window !== "undefined";
		const sourcePage = context?.page;
		const pagePath =
			sourcePage?.path ?? (browser ? window.location.pathname : undefined);
		const page = pagePath
			? {
					path: pagePath,
					title: sourcePage?.title ?? (browser ? document.title : undefined),
					referrer:
						sourcePage?.referrer ?? (browser ? document.referrer : undefined),
					url: browser ? window.location.href : sourcePage?.url,
					host: sourcePage?.host,
					protocol: sourcePage?.protocol,
					search: sourcePage?.search,
				}
			: undefined;

		const sourceUtm = context?.utm;
		const utm = sourceUtm
			? {
					source: sourceUtm.source,
					medium: sourceUtm.medium,
					name: sourceUtm.name,
				}
			: undefined;

		const sourceDevice = context?.device;
		const device =
			sourceDevice || browser
				? {
						type: sourceDevice?.type,
						os: sourceDevice?.os,
						browser: sourceDevice?.browser,
						userAgent: browser ? navigator.userAgent : sourceDevice?.userAgent,
						language: browser ? navigator.language : sourceDevice?.language,
						timezone: browser
							? Intl.DateTimeFormat().resolvedOptions().timeZone
							: sourceDevice?.timezone,
						screen: browser
							? {
									width: window.screen.width,
									height: window.screen.height,
								}
							: sourceDevice?.screen
								? {
										width: sourceDevice.screen.width,
										height: sourceDevice.screen.height,
									}
								: undefined,
						viewport: browser
							? {
									width: window.innerWidth,
									height: window.innerHeight,
								}
							: sourceDevice?.viewport
								? {
										width: sourceDevice.viewport.width,
										height: sourceDevice.viewport.height,
									}
								: undefined,
					}
				: undefined;

		return { page, utm, device };
	}
}
