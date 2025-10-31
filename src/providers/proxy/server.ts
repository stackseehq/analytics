// biome-ignore lint/suspicious/noExplicitAny: Proxy provider needs type assertions to forward generic events
import type { ServerAnalytics } from "@/server.js";
import type { ProxyPayload } from "./types.js";

/**
 * Configuration for ingesting proxy events
 */
export interface IngestProxyEventsConfig {
	/**
	 * Enrich context with server-side data
	 */
	enrichContext?: (request: Request) => Record<string, unknown>;

	/**
	 * Extract IP address from request
	 * Default: Uses standard headers (X-Forwarded-For, X-Real-IP)
	 */
	extractIp?: (request: Request) => string | undefined;

	/**
	 * Error handler
	 */
	onError?: (error: unknown) => void;
}

/**
 * Ingests events from ProxyProvider and replays them through server analytics
 *
 * @example
 * ```typescript
 * // Next.js App Router
 * export async function POST(req: Request) {
 *   await ingestProxyEvents(req, serverAnalytics);
 *   return new Response('OK');
 * }
 *
 * // With custom IP extraction
 * export async function POST(req: Request) {
 *   await ingestProxyEvents(req, serverAnalytics, {
 *     extractIp: (req) => req.headers.get('cf-connecting-ip') // Cloudflare
 *   });
 *   return new Response('OK');
 * }
 * ```
 */
export async function ingestProxyEvents<
	TEventMap extends Record<string, Record<string, unknown>> = Record<
		string,
		Record<string, unknown>
	>,
	TUserTraits extends Record<string, unknown> = Record<string, unknown>,
>(
	request: Request,
	analytics: ServerAnalytics<TEventMap, TUserTraits>,
	config?: IngestProxyEventsConfig,
): Promise<void> {
	try {
		const payload = (await request.json()) as ProxyPayload;

		if (!payload.events || !Array.isArray(payload.events)) {
			throw new Error("Invalid payload: missing events array");
		}

		// Extract IP and enrich context
		const ip = config?.extractIp
			? config.extractIp(request)
			: extractIpFromRequest(request);

		const serverContext = config?.enrichContext
			? config.enrichContext(request)
			: {};

		// Process each event
		for (const event of payload.events) {
			try {
				switch (event.type) {
					case "track": {
						// Enrich context with server data
						const enrichedContext = {
							...event.context,
							...serverContext,
							device: {
								...event.context?.device,
								// Add IP (using type assertion for extended fields)
								// biome-ignore lint/suspicious/noExplicitAny: IP field not in base device type
								...(ip ? ({ ip } as any) : {}),
							},
						};

						// Convert BaseEvent back to track() parameters
						// biome-ignore lint/suspicious/noExplicitAny: Generic event forwarding requires type assertion
						await analytics.track(event.event.action, event.event.properties as any, {
							userId: event.event.userId,
							sessionId: event.event.sessionId,
							// biome-ignore lint/suspicious/noExplicitAny: Generic context forwarding requires type assertion
							context: enrichedContext as any,
						});
						break;
					}

					case "identify": {
						analytics.identify(event.userId, event.traits);
						break;
					}

					case "pageView": {
						// Enrich context with server data
						const enrichedContext = {
							...event.context,
							...serverContext,
							device: {
								...event.context?.device,
							// biome-ignore lint/suspicious/noExplicitAny: IP field not in base device type
								// Add IP (using type assertion for extended fields)
								...(ip ? ({ ip } as any) : {}),
							},
						};
					// biome-ignore lint/suspicious/noExplicitAny: Generic context forwarding requires type assertion

						analytics.pageView(event.properties, enrichedContext as any);
						break;
					}

					case "reset": {
						// ServerAnalytics doesn't have a reset method
						// This is a client-side concept, so we skip it on the server
						break;
					}

					default: {
						console.warn("[Proxy] Unknown event type:", event);
					}
				}
			} catch (error) {
				if (config?.onError) {
					config.onError(error);
				} else {
					console.error("[Proxy] Failed to process event:", error);
				}
			}
		}
	} catch (error) {
		if (config?.onError) {
			config.onError(error);
		} else {
			console.error("[Proxy] Failed to ingest events:", error);
		}
		throw error;
	}
}

/**
 * Extracts IP address from standard proxy headers
 */
function extractIpFromRequest(request: Request): string | undefined {
	// Try standard headers in order of preference
	const headers = [
		"x-forwarded-for",
		"x-real-ip",
		"cf-connecting-ip", // Cloudflare
		"x-client-ip",
		"x-cluster-client-ip",
	];

	for (const header of headers) {
		const value = request.headers.get(header);
		if (value) {
			// X-Forwarded-For can be a comma-separated list, take the first one
			return value.split(",")[0]?.trim();
		}
	}

	return undefined;
}

/**
 * Creates a Request handler for common frameworks
 *
 * @example
 * ```typescript
 * // Next.js App Router
 * export const POST = createProxyHandler(serverAnalytics);
 *
 * // With custom config
 * export const POST = createProxyHandler(serverAnalytics, {
 *   extractIp: (req) => req.headers.get('cf-connecting-ip')
 * });
 * ```
 */
export function createProxyHandler<
	TEventMap extends Record<string, Record<string, unknown>> = Record<
		string,
		Record<string, unknown>
	>,
	TUserTraits extends Record<string, unknown> = Record<string, unknown>,
>(
	analytics: ServerAnalytics<TEventMap, TUserTraits>,
	config?: IngestProxyEventsConfig,
): (request: Request) => Promise<Response> {
	return async (request: Request) => {
		try {
			await ingestProxyEvents(request, analytics, config);
			return new Response("OK", { status: 200 });
		} catch (error) {
			console.error("[Proxy] Handler error:", error);
			return new Response("Internal Server Error", { status: 500 });
		}
	};
}
