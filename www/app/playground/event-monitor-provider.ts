import type { AnalyticsProvider, TrackEventOptions, IdentifyUserOptions, PageViewOptions } from '@stacksee/analytics';

export interface CapturedEvent {
  id: string;
  timestamp: number;
  type: 'track' | 'identify' | 'pageView' | 'pageLeave' | 'reset';
  data: any;
}

export class EventMonitorProvider implements AnalyticsProvider {
  private listeners: Set<(event: CapturedEvent) => void> = new Set();

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async track(eventName: string, properties?: Record<string, unknown>, options?: TrackEventOptions): Promise<void> {
    this.emit({
      id: `track-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      type: 'track',
      data: {
        event: eventName,
        properties,
        context: options?.context,
      },
    });
  }

  async identify(userId: string, traits?: Record<string, unknown>, options?: IdentifyUserOptions): Promise<void> {
    this.emit({
      id: `identify-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      type: 'identify',
      data: {
        userId,
        traits,
      },
    });
  }

  async pageView(properties?: Record<string, unknown>, options?: PageViewOptions): Promise<void> {
    this.emit({
      id: `pageView-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      type: 'pageView',
      data: {
        properties,
        context: options?.context,
      },
    });
  }

  async pageLeave(properties?: Record<string, unknown>): Promise<void> {
    this.emit({
      id: `pageLeave-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      type: 'pageLeave',
      data: {
        properties,
      },
    });
  }

  async reset(): Promise<void> {
    this.emit({
      id: `reset-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      type: 'reset',
      data: {},
    });
  }

  // Event listener methods
  onEvent(callback: (event: CapturedEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: CapturedEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
