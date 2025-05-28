import type {
	AnalyticsProvider,
	BaseEvent,
	EventContext,
} from "@/core/events/types.js";

export abstract class BaseAnalyticsProvider implements AnalyticsProvider {
	abstract name: string;
	protected debug = false;
	protected enabled = true;

	constructor(config?: { debug?: boolean; enabled?: boolean }) {
		if (config?.debug !== undefined) this.debug = config.debug;
		if (config?.enabled !== undefined) this.enabled = config.enabled;
	}

	abstract initialize(): Promise<void> | void;

	abstract identify(
		userId: string,
		traits?: Record<string, unknown>,
	): Promise<void> | void;

	abstract track(
		event: BaseEvent,
		context?: EventContext,
	): Promise<void> | void;

	abstract page(
		properties?: Record<string, unknown>,
		context?: EventContext,
	): Promise<void> | void;

	abstract reset(): Promise<void> | void;

	protected log(message: string, data?: unknown): void {
		if (this.debug) {
			console.log(`[${this.name}] ${message}`, data);
		}
	}

	protected isEnabled(): boolean {
		return this.enabled;
	}
}
