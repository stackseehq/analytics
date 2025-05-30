import { ServerAnalytics } from "@/adapters/server/server-analytics.js";
import type {
	AnalyticsConfig,
	AnalyticsProvider,
} from "@/core/events/types.js";
import type { EventCollection } from "@/core/events/index.js";

// Type to extract event map from event collection
type EventMapFromCollection<T> = T extends EventCollection<infer Events>
	? {
			[K in keyof Events as Events[K] extends { name: infer N }
				? N extends string
					? N
					: never
				: never]: Events[K] extends { properties: infer P } ? P : never;
		}
	: never;

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
 * import { AppEvents } from './events';
 *
 * const analytics = createServerAnalytics<typeof AppEvents>({
 *   providers: [
 *     new PostHogServerProvider({
 *       apiKey: process.env.POSTHOG_API_KEY,
 *       host: process.env.POSTHOG_HOST
 *     })
 *   ],
 *   debug: true,
 *   enabled: true
 * });
 *
 * // Now event names and properties are fully typed!
 * await analytics.track('user_signed_up', {
 *   userId: 'user-123',
 *   email: 'user@example.com',
 *   plan: 'pro'
 * }, { userId: 'user-123' });
 * ```
 */
export function createServerAnalytics<TEvents = never>(
	config: ServerAnalyticsConfig,
): ServerAnalytics<EventMapFromCollection<TEvents>> {
	const analyticsConfig: AnalyticsConfig = {
		providers: config.providers || [],
		debug: config.debug,
		enabled: config.enabled,
	};

	const analytics = new ServerAnalytics<EventMapFromCollection<TEvents>>(
		analyticsConfig,
	);
	analytics.initialize();

	return analytics;
}

export { ServerAnalytics };
