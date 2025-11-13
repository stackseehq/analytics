import { BaseAnalyticsProvider } from "@/providers/base.provider";
import type { BaseEvent, EventContext } from "@/core/events/types";

export class MockAnalyticsProvider extends BaseAnalyticsProvider {
	name = "MockProvider";
	private initialized = false;

	// Track all method calls for testing
	public calls: {
		initialize: number;
		identify: Array<{ userId: string; traits?: Record<string, unknown> }>;
		track: Array<{ event: BaseEvent; context?: EventContext }>;
		pageView: Array<{
			properties?: Record<string, unknown>;
			context?: EventContext;
		}>;
		pageLeave: Array<{
			properties?: Record<string, unknown>;
			context?: EventContext;
		}>;
		reset: number;
	} = {
		initialize: 0,
		identify: [],
		track: [],
		pageView: [],
		pageLeave: [],
		reset: 0,
	};

	initialize(): void {
		this.calls.initialize++;
		this.initialized = true;
		this.log("Initialized");
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.isEnabled() || !this.initialized) return;
		this.calls.identify.push({ userId, traits });
		this.log("Identified user", { userId, traits });
	}

	track(event: BaseEvent, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized) return;
		this.calls.track.push({ event, context });
		this.log("Tracked event", { event, context });
	}

	pageView(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled() || !this.initialized) return;
		this.calls.pageView.push({ properties, context });
		this.log("Tracked page view", { properties, context });
	}

	pageLeave(
		properties?: Record<string, unknown>,
		context?: EventContext,
	): void {
		if (!this.isEnabled() || !this.initialized) return;
		this.calls.pageLeave.push({ properties, context });
		this.log("Tracked page leave", { properties, context });
	}

	reset(): void {
		if (!this.isEnabled() || !this.initialized) return;
		this.calls.reset++;
		this.log("Reset");
	}

	// Helper method to clear all calls
	clearCalls(): void {
		this.calls = {
			initialize: 0,
			identify: [],
			track: [],
			pageView: [],
			pageLeave: [],
			reset: 0,
		};
	}

	// Helper to check if initialized (for testing)
	isInitialized(): boolean {
		return this.initialized;
	}
}
