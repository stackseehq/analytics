'use client';

export interface AnalyticsEvent {
  id: string;
  timestamp: number;
  eventName: string;
  properties: Record<string, unknown>;
  providers: string[];
}

export type EventListener = (event: AnalyticsEvent) => void;

class MockAnalytics {
  private listeners: Set<EventListener> = new Set();
  private providers = new Set<string>();

  addProvider(name: string) {
    this.providers.add(name);
  }

  subscribe(listener: EventListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  track(eventName: string, properties: Record<string, unknown> = {}) {
    const event: AnalyticsEvent = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      eventName,
      properties,
      providers: Array.from(this.providers),
    };

    // Simulate slight delay for realism
    setTimeout(() => {
      this.listeners.forEach((listener) => listener(event));
    }, 50);
  }

  page(pageName: string, properties: Record<string, unknown> = {}) {
    this.track('$pageview', { page: pageName, ...properties });
  }
}

export const mockAnalytics = new MockAnalytics();

// Initialize providers
mockAnalytics.addProvider('PostHog');
mockAnalytics.addProvider('Segment');
mockAnalytics.addProvider('Mixpanel');
