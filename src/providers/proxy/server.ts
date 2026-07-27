import type {
	ServerAnalytics,
	ServerTrackOptions,
} from "@/adapters/server/server-analytics.js";
import type {
	EventDefinitions,
	EventRegistry,
} from "@/core/events/registry.js";
import type { EventContext, UserContext } from "@/core/events/types.js";
import type {
	ProxyClientContext,
	ProxyEventV2,
	ProxyPayloadV2,
	ProxyTrackEventV2,
} from "./types.js";

export type ProxyTrustErrorCode = "invalid_payload" | "identity_required";

export class ProxyTrustError extends Error {
	readonly name = "ProxyTrustError";

	constructor(readonly code: ProxyTrustErrorCode) {
		super(`Proxy request rejected: ${code}`);
	}
}

export interface ProxyTrustedIdentity<
	TTraits extends object = Record<string, unknown>,
> {
	readonly userId?: string;
	readonly user?: UserContext<TTraits>;
}

/**
 * Configuration for ingesting proxy events.
 */
export interface IngestProxyEventsConfig<
	TUserTraits extends object = Record<string, unknown>,
> {
	/**
	 * Enrich context with server-owned data.
	 */
	readonly enrichContext?: (
		request: Request,
	) => Partial<EventContext<TUserTraits>>;

	/**
	 * Extract IP address from request.
	 * Default: Uses standard proxy headers.
	 */
	readonly extractIp?: (request: Request) => string | undefined;

	/**
	 * Resolve identity from authenticated server state. Payload identity fields
	 * are claims for resolver input only and are never sent to providers.
	 */
	readonly resolveIdentity?: (args: {
		readonly request: Request;
		readonly event: ProxyEventV2;
	}) =>
		| ProxyTrustedIdentity<TUserTraits>
		| undefined
		| Promise<ProxyTrustedIdentity<TUserTraits> | undefined>;

	/**
	 * Error handler.
	 */
	readonly onError?: (error: unknown) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidClientContext(value: unknown): boolean {
	if (value === undefined) return true;
	if (!isRecord(value)) return false;

	for (const key of ["page", "utm", "device"] as const) {
		const nested = value[key];
		if (nested !== undefined && !isRecord(nested)) return false;
	}

	const device = value.device;
	if (isRecord(device)) {
		for (const key of ["screen", "viewport"] as const) {
			const nested = device[key];
			if (nested !== undefined && !isRecord(nested)) return false;
		}
	}

	return true;
}

function isProxyEventV2(value: unknown): value is ProxyEventV2 {
	if (!isRecord(value) || typeof value.type !== "string") return false;

	switch (value.type) {
		case "track":
			return (
				typeof value.name === "string" &&
				typeof value.inputProvided === "boolean" &&
				typeof value.occurredAt === "number" &&
				Number.isFinite(value.occurredAt) &&
				(value.sessionId === undefined ||
					typeof value.sessionId === "string") &&
				hasValidClientContext(value.context)
			);

		case "identify":
			return (
				typeof value.userId === "string" &&
				(value.traits === undefined || isRecord(value.traits))
			);

		case "pageView":
			return (
				(value.properties === undefined || isRecord(value.properties)) &&
				typeof value.occurredAt === "number" &&
				Number.isFinite(value.occurredAt) &&
				hasValidClientContext(value.context)
			);

		case "reset":
			return true;

		default:
			return false;
	}
}

function parseProxyPayload(value: unknown): ProxyPayloadV2 {
	if (
		!isRecord(value) ||
		value.version !== 2 ||
		!Array.isArray(value.events) ||
		!value.events.every(isProxyEventV2)
	) {
		throw new ProxyTrustError("invalid_payload");
	}

	return value as unknown as ProxyPayloadV2;
}

function sanitizeClientContext(
	context: ProxyClientContext | undefined,
): ProxyClientContext {
	const page = context?.page
		? {
				path: context.page.path,
				title: context.page.title,
				referrer: context.page.referrer,
				url: context.page.url,
				host: context.page.host,
				protocol: context.page.protocol,
				search: context.page.search,
			}
		: undefined;
	const utm = context?.utm
		? {
				source: context.utm.source,
				medium: context.utm.medium,
				name: context.utm.name,
			}
		: undefined;
	const device = context?.device
		? {
				type: context.device.type,
				os: context.device.os,
				browser: context.device.browser,
				userAgent: context.device.userAgent,
				language: context.device.language,
				timezone: context.device.timezone,
				screen: context.device.screen
					? {
							width: context.device.screen.width,
							height: context.device.screen.height,
						}
					: undefined,
				viewport: context.device.viewport
					? {
							width: context.device.viewport.width,
							height: context.device.viewport.height,
						}
					: undefined,
			}
		: undefined;

	return { page, utm, device };
}

function buildTrustedUser<TUserTraits extends object>(
	identity: ProxyTrustedIdentity<TUserTraits> | undefined,
): UserContext<TUserTraits> | undefined {
	const userId = identity?.userId ?? identity?.user?.userId;
	if (!identity?.user && !userId) return undefined;

	return {
		userId,
		email: identity?.user?.email,
		traits: identity?.user?.traits,
	};
}

function buildServerContext<TUserTraits extends object>(
	clientContext: ProxyClientContext | undefined,
	enrichment: Partial<EventContext<TUserTraits>>,
	userAgent: string | null,
	ip: string | undefined,
): EventContext<TUserTraits> {
	const safeClientContext = sanitizeClientContext(clientContext);
	const context: EventContext<TUserTraits> = {};

	if (safeClientContext.page || enrichment.page) {
		context.page = {
			...safeClientContext.page,
			...enrichment.page,
		} as NonNullable<EventContext<TUserTraits>["page"]>;
	}
	if (safeClientContext.utm || enrichment.utm) {
		context.utm = {
			...safeClientContext.utm,
			...enrichment.utm,
		};
	}
	if (safeClientContext.device || enrichment.device || userAgent || ip) {
		context.device = {
			...safeClientContext.device,
			...enrichment.device,
			...(userAgent ? { userAgent } : {}),
			...(ip ? { ip } : {}),
		};
	}
	if (enrichment.server || userAgent) {
		context.server = {
			...enrichment.server,
			...(userAgent ? { userAgent } : {}),
		};
	}

	return context;
}

async function trackRuntimeEvent<
	TRegistry extends EventRegistry<EventDefinitions>,
	TUserTraits extends object,
>(
	analytics: ServerAnalytics<TRegistry, TUserTraits>,
	event: ProxyTrackEventV2,
	options: ServerTrackOptions<TUserTraits>,
): Promise<void> {
	const runtimeTrack = analytics.track as unknown as (
		eventName: string,
		inputOrOptions?: unknown,
		options?: ServerTrackOptions<TUserTraits>,
	) => Promise<void>;

	if (event.inputProvided) {
		if (event.input === undefined) {
			// The public adapter's legacy three-argument propertyless form treats
			// `(name, undefined, options)` as omitted input. Use the two-argument
			// public form here so V2's explicit `inputProvided: true` remains
			// distinguishable and follows normal invalid-properties handling.
			await runtimeTrack.call(analytics, event.name, event.input);
		} else {
			await runtimeTrack.call(analytics, event.name, event.input, options);
		}
	} else {
		await runtimeTrack.call(analytics, event.name, options);
	}
}

function reportError<TUserTraits extends object>(
	error: unknown,
	config: IngestProxyEventsConfig<TUserTraits> | undefined,
	message: string,
): void {
	if (config?.onError) {
		try {
			config.onError(error);
		} catch {
			// Error reporting must not replace the original trust error.
		}
		return;
	}
	console.error(message, error);
}

/**
 * Ingests version 2 events from ProxyProvider through the normal server
 * validation path.
 */
export async function ingestProxyEvents<
	TRegistry extends EventRegistry<EventDefinitions>,
	TUserTraits extends object = Record<string, unknown>,
>(
	request: Request,
	analytics: ServerAnalytics<TRegistry, TUserTraits>,
	config?: IngestProxyEventsConfig<TUserTraits>,
): Promise<void> {
	try {
		let rawPayload: unknown;
		try {
			rawPayload = await request.json();
		} catch {
			throw new ProxyTrustError("invalid_payload");
		}
		const proxyPayload = parseProxyPayload(rawPayload);
		const ip = config?.extractIp
			? config.extractIp(request)
			: extractIpFromRequest(request);
		const userAgent = request.headers.get("user-agent");
		const enrichment = config?.enrichContext?.(request) ?? {};

		for (const event of proxyPayload.events) {
			try {
				switch (event.type) {
					case "track": {
						const identity = await config?.resolveIdentity?.({
							request,
							event,
						});
						const trustedUser = buildTrustedUser(identity);
						const context = buildServerContext(
							event.context,
							enrichment,
							userAgent,
							ip,
						);
						const options: ServerTrackOptions<TUserTraits> = {
							userId: identity?.userId ?? identity?.user?.userId,
							sessionId: event.sessionId,
							context,
							user: trustedUser,
						};

						await trackRuntimeEvent(analytics, event, options);
						break;
					}

					case "identify": {
						const identity = await config?.resolveIdentity?.({
							request,
							event,
						});
						const trustedUserId = identity?.userId ?? identity?.user?.userId;
						if (!trustedUserId) {
							reportError(
								new ProxyTrustError("identity_required"),
								config,
								"[Proxy] Identity resolution failed:",
							);
							break;
						}

						await analytics.identify(trustedUserId, identity?.user?.traits);
						break;
					}

					case "pageView": {
						const identity = await config?.resolveIdentity?.({
							request,
							event,
						});
						const context = buildServerContext(
							event.context,
							enrichment,
							userAgent,
							ip,
						);
						context.user = buildTrustedUser(identity);

						await analytics.pageView(event.properties, { context });
						break;
					}

					case "reset":
						break;
				}
			} catch (error) {
				reportError(error, config, "[Proxy] Failed to process event:");
			}
		}
	} catch (error) {
		reportError(error, config, "[Proxy] Failed to ingest events:");
		throw error;
	}
}

/**
 * Extracts an IP address from standard proxy headers.
 */
function extractIpFromRequest(request: Request): string | undefined {
	const headers = [
		"x-forwarded-for",
		"x-real-ip",
		"cf-connecting-ip",
		"x-client-ip",
		"x-cluster-client-ip",
	];

	for (const header of headers) {
		const value = request.headers.get(header);
		if (value) {
			return value.split(",")[0]?.trim();
		}
	}

	return undefined;
}

/**
 * Creates a Request handler for common frameworks.
 */
export function createProxyHandler<
	TRegistry extends EventRegistry<EventDefinitions>,
	TUserTraits extends object = Record<string, unknown>,
>(
	analytics: ServerAnalytics<TRegistry, TUserTraits>,
	config?: IngestProxyEventsConfig<TUserTraits>,
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
