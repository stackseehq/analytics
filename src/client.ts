import { BrowserAnalytics } from "@/adapters/client/browser-analytics.js";
import type {
	AnalyticsConfig,
	AnalyticsProvider,
} from "@/core/events/types.js";
import type { EventMapFromCollection } from "@/core/events/index.js";

// Default event map type
type DefaultEventMap = Record<string, Record<string, unknown>>;

let analyticsInstance: BrowserAnalytics<DefaultEventMap> | null = null;

export interface ClientAnalyticsConfig {
	providers?: AnalyticsProvider[];
	debug?: boolean;
	enabled?: boolean;
}

/**
 * Initialize analytics for the browser
 *
 * @example
 * ```typescript
 * import { createClientAnalytics } from '@stacksee/analytics/client';
 * import { PostHogClientProvider } from '@stacksee/analytics/providers/posthog';
 * import { AppEvents } from './events';
 *
 * const analytics = createClientAnalytics<typeof AppEvents>({
 *   providers: [
 *     new PostHogClientProvider({
 *       apiKey: 'your-api-key',
 *       host: 'https://app.posthog.com'
 *     })
 *   ],
 *   debug: true,
 *   enabled: true
 * });
 *
 * // Now event names and properties are fully typed!
 * analytics.track('user_signed_up', {
 *   userId: 'user-123',
 *   email: 'user@example.com',
 *   plan: 'pro'
 * });
 * ```
 */
export function createClientAnalytics<TEvents = never>(
	config: ClientAnalyticsConfig,
): BrowserAnalytics<EventMapFromCollection<TEvents>> {
	if (analyticsInstance) {
		console.warn("[Analytics] Already initialized");
		return analyticsInstance as BrowserAnalytics<
			EventMapFromCollection<TEvents>
		>;
	}

	const analyticsConfig: AnalyticsConfig = {
		providers: config.providers || [],
		debug: config.debug,
		enabled: config.enabled,
	};

	analyticsInstance = new BrowserAnalytics<EventMapFromCollection<TEvents>>(
		analyticsConfig,
	);

	// Auto-initialize in the background without blocking
	analyticsInstance.initialize().catch((error) => {
		console.error("[Analytics] Failed to initialize:", error);
	});

	return analyticsInstance;
}

// Convenience export for backwards compatibility
export { createClientAnalytics as createAnalytics };

/**
 * Get the current analytics instance
 */
export function getAnalytics(): BrowserAnalytics<DefaultEventMap> {
	if (!analyticsInstance) {
		throw new Error(
			"[Analytics] Not initialized. Call createAnalytics() first.",
		);
	}
	return analyticsInstance;
}

/**
 * Convenience function to track events
 */
export function track(
	eventName: string,
	properties: Record<string, unknown>,
): Promise<void> {
	return getAnalytics().track(eventName, properties);
}

/**
 * Convenience function to identify users
 */
export function identify(
	userId: string,
	traits?: Record<string, unknown>,
): void {
	getAnalytics().identify(userId, traits);
}

/**
 * Convenience function to track page views
 */
export function pageView(properties?: Record<string, unknown>): void {
	getAnalytics().pageView(properties);
}

/**
 * Convenience function to track page leave events
 */
export function pageLeave(properties?: Record<string, unknown>): void {
	getAnalytics().pageLeave(properties);
}

/**
 * Convenience function to reset user session
 */
export function reset(): void {
	getAnalytics().reset();
}

/**
 * Reset the analytics instance (for testing purposes)
 * @internal
 */
export function resetAnalyticsInstance(): void {
	analyticsInstance = null;
}
