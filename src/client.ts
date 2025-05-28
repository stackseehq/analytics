import { BrowserAnalytics } from "@/adapters/client/browser-analytics.js";
import type {
	AnalyticsConfig,
	AnalyticsProvider,
} from "@/core/events/types.js";

let analyticsInstance: BrowserAnalytics | null = null;

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
 *
 * const analytics = await createClientAnalytics({
 *   providers: [
 *     new PostHogClientProvider({
 *       apiKey: 'your-api-key',
 *       host: 'https://app.posthog.com'
 *     })
 *   ],
 *   debug: true,
 *   enabled: true
 * });
 * ```
 */
export async function createClientAnalytics(
	config: ClientAnalyticsConfig,
): Promise<BrowserAnalytics> {
	if (analyticsInstance) {
		console.warn("[Analytics] Already initialized");
		return analyticsInstance;
	}

	const analyticsConfig: AnalyticsConfig = {
		providers: config.providers || [],
		debug: config.debug,
		enabled: config.enabled,
	};

	analyticsInstance = new BrowserAnalytics(analyticsConfig);
	await analyticsInstance.initialize();

	return analyticsInstance;
}

// Convenience export for backwards compatibility
export { createClientAnalytics as createAnalytics };

/**
 * Get the current analytics instance
 */
export function getAnalytics(): BrowserAnalytics {
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
): void {
	getAnalytics().track(eventName, properties);
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
export function page(properties?: Record<string, unknown>): void {
	getAnalytics().page(properties);
}

/**
 * Convenience function to reset user session
 */
export function reset(): void {
	getAnalytics().reset();
}
