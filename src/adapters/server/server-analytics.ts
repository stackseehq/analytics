import type { AnyEventName, AnyEventProperties } from "@/core/events/index.js";
import type {
	AnalyticsConfig,
	AnalyticsProvider,
	BaseEvent,
	EventCategory,
	EventContext,
	UserContext,
} from "@/core/events/types.js";

// Default event map type - allows any event with any properties when no specific map is provided
type DefaultEventMap = Record<string, Record<string, unknown>>;

export class ServerAnalytics<
	TEventMap extends Record<string, Record<string, unknown>> = DefaultEventMap,
	TUserTraits extends Record<string, unknown> = Record<string, unknown>,
> {
	private providers: AnalyticsProvider[] = [];
	private config: AnalyticsConfig;
	private initialized = false;

	/**
	 * Creates a new ServerAnalytics instance for server-side event tracking.
	 * 
	 * The server analytics instance is designed for Node.js environments including
	 * long-running servers, serverless functions, and edge computing environments.
	 * 
	 * @param config Analytics configuration including providers and default context
	 * @param config.providers Array of analytics provider instances (e.g., PostHogServerProvider)
	 * @param config.defaultContext Optional default context to include with all events
	 * 
	 * @example
	 * ```typescript
	 * import { ServerAnalytics } from '@stacksee/analytics/server';
	 * import { PostHogServerProvider } from '@stacksee/analytics/providers/posthog';
	 * 
	 * const analytics = new ServerAnalytics({
	 *   providers: [
	 *     new PostHogServerProvider({
	 *       apiKey: process.env.POSTHOG_API_KEY,
	 *       host: process.env.POSTHOG_HOST
	 *     })
	 *   ],
	 *   defaultContext: {
	 *     app: { version: '1.0.0', environment: 'production' }
	 *   }
	 * });
	 * 
	 * analytics.initialize();
	 * ```
	 */
	constructor(config: AnalyticsConfig) {
		this.config = config;
		this.providers = config.providers;
	}

	/**
	 * Initializes all analytics providers.
	 * 
	 * This method must be called before tracking events. It initializes all configured
	 * providers synchronously. Unlike the browser version, server initialization is
	 * typically synchronous as providers don't need to load external scripts.
	 * 
	 * The method is safe to call multiple times and will not re-initialize if already done.
	 * 
	 * @example
	 * ```typescript
	 * const analytics = new ServerAnalytics({ providers: [] });
	 * 
	 * // Initialize before tracking events
	 * analytics.initialize();
	 * 
	 * // Now ready to track events
	 * await analytics.track('api_request', { endpoint: '/users' });
	 * ```
	 * 
	 * @example
	 * ```typescript
	 * // In a serverless function
	 * export async function handler(req, res) {
	 *   const analytics = new ServerAnalytics({ providers: [] });
	 *   analytics.initialize(); // Quick synchronous initialization
	 *   
	 *   await analytics.track('function_invoked', {
	 *     path: req.path,
	 *     method: req.method
	 *   });
	 *   
	 *   await analytics.shutdown(); // Important for serverless
	 * }
	 * ```
	 */
	initialize(): void {
		if (this.initialized) return;

		// Initialize all providers synchronously
		for (const provider of this.providers) {
			provider.initialize();
		}

		this.initialized = true;
	}

	/**
	 * Identifies a user with optional traits.
	 * 
	 * Associates subsequent events with the specified user ID and optionally
	 * sets user properties. This method is typically called when processing
	 * authentication or when you have user context available on the server.
	 * 
	 * @param userId Unique identifier for the user (e.g., database ID, email)
	 * @param traits Optional user properties and characteristics
	 * 
	 * @example
	 * ```typescript
	 * // Basic user identification
	 * analytics.identify('user-123');
	 * ```
	 * 
	 * @example
	 * ```typescript
	 * // Identify with user traits from database
	 * analytics.identify('user-123', {
	 *   email: 'john@example.com',
	 *   name: 'John Doe',
	 *   plan: 'enterprise',
	 *   company: 'Acme Corp',
	 *   createdAt: '2024-01-15T10:00:00Z',
	 *   lastSeenAt: new Date().toISOString()
	 * });
	 * ```
	 * 
	 * @example
	 * ```typescript
	 * // In an API authentication middleware
	 * async function authMiddleware(req, res, next) {
	 *   const user = await getUserFromToken(req.headers.authorization);
	 *   
	 *   analytics.identify(user.id, {
	 *     email: user.email,
	 *     role: user.role,
	 *     organization: user.organization
	 *   });
	 *   
	 *   req.user = user;
	 *   next();
	 * }
	 * ```
	 */
	identify(userId: string, traits?: Record<string, unknown>): void {
		for (const provider of this.providers) {
			provider.identify(userId, traits);
		}
	}

	/**
	 * Tracks a custom event with properties and optional context.
	 *
	 * This is the main method for tracking business events on the server side.
	 * The method sends the event to all configured providers and waits for completion.
	 * Failed providers don't prevent others from succeeding.
	 *
	 * Server-side tracking typically includes additional context like IP addresses,
	 * user agents, and server-specific metadata that isn't available on the client.
	 *
	 * **User Context (New):** You can now pass user data (email, traits) with each event
	 * via `options.user` or `options.context.user`. This is useful for providers like
	 * Loops, Customer.io, or Intercom that require user identifiers.
	 *
	 * @param eventName Name of the event to track (must match your event definitions)
	 * @param properties Event-specific properties and data
	 * @param options Optional configuration including user ID, session ID, user context, and additional context
	 * @param options.userId User ID to associate with this event
	 * @param options.sessionId Session ID to associate with this event
	 * @param options.user User context including email and traits (automatically included in event context)
	 * @param options.context Additional context for this event (page, device, etc.)
	 * @returns Promise that resolves when tracking is complete for all providers
	 *
	 * @example
	 * ```typescript
	 * // Basic event tracking
	 * await analytics.track('api_request', {
	 *   endpoint: '/api/users',
	 *   method: 'GET',
	 *   responseTime: 150,
	 *   statusCode: 200
	 * });
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Track with user context (recommended for email-based providers)
	 * await analytics.track('purchase_completed', {
	 *   orderId: 'order-123',
	 *   amount: 99.99,
	 *   currency: 'USD',
	 *   itemCount: 3
	 * }, {
	 *   userId: 'user-456',
	 *   user: {
	 *     email: 'user@example.com',
	 *     traits: {
	 *       plan: 'pro',
	 *       company: 'Acme Corp'
	 *     }
	 *   },
	 *   context: {
	 *     page: { path: '/checkout/complete' },
	 *     device: { userAgent: req.headers['user-agent'] }
	 *   }
	 * });
	 * // Providers receive: context.user = { email: 'user@example.com', traits: {...} }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Alternative: Pass user via context.user
	 * await analytics.track('feature_used', {
	 *   featureName: 'export'
	 * }, {
	 *   userId: 'user-123',
	 *   context: {
	 *     user: {
	 *       email: 'user@example.com'
	 *     },
	 *     page: { path: '/dashboard' }
	 *   }
	 * });
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // In an Express.js route handler with user data
	 * app.post('/api/users', async (req, res) => {
	 *   const user = await createUser(req.body);
	 *
	 *   // Track user creation with full user context
	 *   await analytics.track('user_created', {
	 *     userId: user.id,
	 *     email: user.email,
	 *     plan: user.plan
	 *   }, {
	 *     userId: user.id,
	 *     user: {
	 *       email: user.email,
	 *       traits: {
	 *         name: user.name,
	 *         plan: user.plan,
	 *         company: user.company
	 *       }
	 *     },
	 *     context: {
	 *       page: { path: req.path },
	 *       device: { userAgent: req.headers['user-agent'] }
	 *     }
	 *   });
	 *
	 *   res.json(user);
	 * });
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Error handling in tracking
	 * try {
	 *   await analytics.track('payment_processed', {
	 *     amount: 100,
	 *     currency: 'USD'
	 *   });
	 * } catch (error) {
	 *   // This only catches initialization errors
	 *   // Individual provider failures are logged but don't throw
	 *   console.error('Failed to track event:', error);
	 * }
	 * ```
	 */
	async track<TEventName extends string>(
		eventName: TEventName,
		properties: TEventName extends keyof TEventMap
			? TEventMap[TEventName]
			: Record<string, unknown>,
		options?: {
			userId?: string;
			sessionId?: string;
			context?: EventContext<TUserTraits>;
			user?: UserContext<TUserTraits>;
		},
	): Promise<void> {
		if (!this.initialized) {
			console.warn("[Analytics] Not initialized. Call initialize() first.");
			return;
		}

		const event: BaseEvent = {
			action: eventName,
			category: this.getCategoryFromEventName(eventName),
			properties: properties as Record<string, unknown>,
			timestamp: Date.now(),
			userId: options?.userId,
			sessionId: options?.sessionId,
		};

		const context: EventContext<TUserTraits> = {
			...this.config.defaultContext,
			...options?.context,
			user: options?.user || options?.context?.user,
		};

		// Track with all providers in parallel
		const trackPromises = this.providers.map(async (provider) => {
			try {
				await provider.track(event, context);
			} catch (error) {
				// Log error but don't throw - one provider failing shouldn't break others
				console.error(
					`[Analytics] Provider ${provider.name} failed to track event:`,
					error,
				);
			}
		});

		// Wait for all providers to complete
		await Promise.all(trackPromises);
	}

	/**
	 * Tracks a page view event from the server side.
	 * 
	 * Server-side page view tracking is useful for server-rendered applications,
	 * SSR frameworks, or when you want to ensure page views are tracked even
	 * if client-side JavaScript fails.
	 * 
	 * @param properties Optional properties to include with the page view
	 * @param options Optional configuration including context
	 * @param options.context Additional context for this page view
	 * 
	 * @example
	 * ```typescript
	 * // Basic server-side page view
	 * analytics.pageView();
	 * ```
	 * 
	 * @example
	 * ```typescript
	 * // Page view with server context
	 * analytics.pageView({
	 *   loadTime: 250,
	 *   template: 'product-detail',
	 *   ssr: true
	 * }, {
	 *   context: {
	 *     page: {
	 *       path: '/products/widget-123',
	 *       title: 'Amazing Widget - Product Details'
	 *     },
	 *     device: {
	 *       userAgent: req.headers['user-agent']
	 *     },
	 *     server: {
	 *       renderTime: 45,
	 *       cacheHit: false
	 *     }
	 *   }
	 * });
	 * ```
	 * 
	 * @example
	 * ```typescript
	 * // In a Next.js API route or middleware
	 * export async function middleware(req) {
	 *   if (req.nextUrl.pathname.startsWith('/product/')) {
	 *     analytics.pageView({
	 *       category: 'product',
	 *       productId: req.nextUrl.pathname.split('/').pop()
	 *     }, {
	 *       context: {
	 *         page: { path: req.nextUrl.pathname },
	 *         device: { userAgent: req.headers.get('user-agent') },
	 *         referrer: req.headers.get('referer')
	 *       }
	 *     });
	 *   }
	 * }
	 * ```
	 */
	pageView(
		properties?: Record<string, unknown>,
		options?: {
			context?: EventContext<TUserTraits>;
		},
	): void {
		if (!this.initialized) return;

		const context: EventContext<TUserTraits> = {
			...this.config.defaultContext,
			...options?.context,
		} as EventContext<TUserTraits>;

		for (const provider of this.providers) {
			provider.pageView(properties, context);
		}
	}

	/**
	 * Tracks when a user leaves a page from the server side.
	 * 
	 * Server-side page leave tracking is less common than client-side but can be
	 * useful in certain scenarios like tracking session timeouts, or when combined
	 * with server-side session management.
	 * 
	 * Note: Not all analytics providers support page leave events. The method
	 * will only call providers that implement the pageLeave method.
	 * 
	 * @param properties Optional properties to include with the page leave event
	 * @param options Optional configuration including context
	 * @param options.context Additional context for this page leave
	 * 
	 * @example
	 * ```typescript
	 * // Basic page leave tracking
	 * analytics.pageLeave();
	 * ```
	 * 
	 * @example
	 * ```typescript
	 * // Page leave with session context
	 * analytics.pageLeave({
	 *   sessionDuration: 45000, // 45 seconds
	 *   pagesViewed: 3,
	 *   exitReason: 'session_timeout'
	 * }, {
	 *   context: {
	 *     session: {
	 *       id: 'session-123',
	 *       startTime: sessionStartTime,
	 *       endTime: Date.now()
	 *     },
	 *     server: {
	 *       reason: 'inactivity_timeout'
	 *     }
	 *   }
	 * });
	 * ```
	 * 
	 * @example
	 * ```typescript
	 * // In a session cleanup job
	 * async function cleanupExpiredSessions() {
	 *   const expiredSessions = await getExpiredSessions();
	 *   
	 *   for (const session of expiredSessions) {
	 *     analytics.pageLeave({
	 *       sessionId: session.id,
	 *       duration: session.duration,
	 *       reason: 'expired'
	 *     });
	 *     
	 *     await removeSession(session.id);
	 *   }
	 * }
	 * ```
	 */
	pageLeave(
		properties?: Record<string, unknown>,
		options?: {
			context?: EventContext<TUserTraits>;
		},
	): void {
		if (!this.initialized) return;

		const context: EventContext<TUserTraits> = {
			...this.config.defaultContext,
			...options?.context,
		} as EventContext<TUserTraits>;

		for (const provider of this.providers) {
			if (provider.pageLeave) {
				provider.pageLeave(properties, context);
			}
		}
	}

	/**
	 * Shuts down all analytics providers and flushes pending events.
	 * 
	 * This method is crucial for server environments, especially serverless functions,
	 * as it ensures all events are sent before the process terminates. Some providers
	 * batch events and need an explicit flush to send them.
	 * 
	 * Always call this method before your server shuts down or before a serverless
	 * function completes execution.
	 * 
	 * @returns Promise that resolves when all providers have been shut down
	 * 
	 * @example
	 * ```typescript
	 * // Basic shutdown
	 * await analytics.shutdown();
	 * ```
	 * 
	 * @example
	 * ```typescript
	 * // In a serverless function
	 * export async function handler(event, context) {
	 *   const analytics = new ServerAnalytics({ providers: [] });
	 *   analytics.initialize();
	 *   
	 *   try {
	 *     // Process the event
	 *     await processEvent(event);
	 *     
	 *     // Track completion
	 *     await analytics.track('function_completed', {
	 *       duration: Date.now() - startTime,
	 *       success: true
	 *     });
	 *   } catch (error) {
	 *     await analytics.track('function_failed', {
	 *       error: error.message,
	 *       duration: Date.now() - startTime
	 *     });
	 *   } finally {
	 *     // Always shutdown to flush events
	 *     await analytics.shutdown();
	 *   }
	 *   
	 *   return { statusCode: 200 };
	 * }
	 * ```
	 * 
	 * @example
	 * ```typescript
	 * // In an Express.js server
	 * const server = app.listen(3000);
	 * 
	 * // Graceful shutdown
	 * process.on('SIGTERM', async () => {
	 *   console.log('Shutting down gracefully...');
	 *   
	 *   server.close(async () => {
	 *     // Flush analytics events before exit
	 *     await analytics.shutdown();
	 *     process.exit(0);
	 *   });
	 * });
	 * ```
	 * 
	 * @example
	 * ```typescript
	 * // With Vercel's waitUntil
	 * import { waitUntil } from '@vercel/functions';
	 * 
	 * export default async function handler(req, res) {
	 *   // Process request
	 *   const result = await processRequest(req);
	 *   
	 *   // Track in background without blocking response
	 *   waitUntil(
	 *     analytics.track('api_request', { endpoint: req.url })
	 *       .then(() => analytics.shutdown())
	 *   );
	 *   
	 *   return res.json(result);
	 * }
	 * ```
	 */
	async shutdown(): Promise<void> {
		// Shutdown all providers that support it
		const shutdownPromises = this.providers.map((provider) => {
			if ("shutdown" in provider && typeof provider.shutdown === "function") {
				return provider.shutdown();
			}
			return Promise.resolve();
		});

		await Promise.all(shutdownPromises);
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
}
