import { ServerAnalytics } from "@/adapters/server/server-analytics.js";
import type {
	AnalyticsConfig,
	AnalyticsProvider,
} from "@/core/events/types.js";

export interface ServerAnalyticsConfig {
	providers?: AnalyticsProvider[];
	debug?: boolean;
	enabled?: boolean;
}

/**
 * Create a server analytics instance
 *
 * @example
 * ```typescript
 * import { createServerAnalytics } from '@stacksee/analytics/server';
 * import { PostHogServerProvider } from '@stacksee/analytics/providers/posthog';
 *
 * const analytics = createServerAnalytics({
 *   providers: [
 *     new PostHogServerProvider({
 *       apiKey: process.env.POSTHOG_API_KEY,
 *       host: process.env.POSTHOG_HOST
 *     })
 *   ],
 *   debug: true,
 *   enabled: true
 * });
 * ```
 */
export function createServerAnalytics(
	config: ServerAnalyticsConfig,
): ServerAnalytics {
	const analyticsConfig: AnalyticsConfig = {
		providers: config.providers || [],
		debug: config.debug,
		enabled: config.enabled,
	};

	const analytics = new ServerAnalytics(analyticsConfig);
	analytics.initialize();

	return analytics;
}

export { ServerAnalytics };
