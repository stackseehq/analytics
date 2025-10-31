'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { mockAnalytics, type AnalyticsEvent } from './analytics-mock';

const PROVIDER_CONFIG = {
  PostHog: {
    className: 'bg-primary/10 text-primary border-primary/20',
    domain: 'posthog.com',
  },
  Segment: {
    className: 'bg-accent/10 text-accent-foreground border-accent/20',
    domain: 'segment.com',
  },
  Mixpanel: {
    className: 'bg-secondary text-secondary-foreground border-secondary',
    domain: 'mixpanel.com',
  },
} as const;

export function EventLog() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);

  useEffect(() => {
    const unsubscribe = mockAnalytics.subscribe((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 50)); // Keep last 50 events
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <Card className="h-full flex flex-col">
      <div className="border-b p-4">
        <h3 className="font-semibold text-sm">Event Stream</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {events.length} event{events.length !== 1 ? 's' : ''} captured
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No events yet</p>
              <p className="text-xs mt-1">Interact with the product to see events</p>
            </div>
          ) : (
            events.map((event, index) => (
              <div
                key={event.id}
                className={cn(
                  'rounded-lg border bg-card p-3 transition-all duration-300',
                  index === 0 && 'ring-2 ring-ring/20 animate-in fade-in slide-in-from-top-2'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-semibold text-sm truncate">
                      {event.eventName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground/60">
                    {index === 0 ? 'just now' : `${Math.floor((Date.now() - event.timestamp) / 1000)}s ago`}
                  </div>
                </div>

                {Object.keys(event.properties).length > 0 && (
                  <div className="mb-2 p-2 bg-muted/50 rounded border">
                    <div className="text-xs font-mono space-y-0.5">
                      {Object.entries(event.properties).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="text-muted-foreground">{key}:</span>
                          <span className="text-foreground font-medium">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {event.providers.map((provider) => {
                    const config = PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG];
                    return (
                      <Badge
                        key={provider}
                        variant="outline"
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 flex items-center gap-1.5',
                          config.className
                        )}
                      >
                        <img
                          src={`https://favicon.vemetric.com/${config.domain}?size=16`}
                          alt={`${provider} icon`}
                          className="w-3 h-3"
                        />
                        {provider}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
