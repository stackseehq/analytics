"use client";

import { ProductDemo } from "@/app/docs/playground/product-demo";
import { EventLog } from "@/app/docs/playground/event-log";

export interface AnalyticsPlaygroundProps {
	showHeader?: boolean;
	showFooter?: boolean;
	compact?: boolean;
}

export function AnalyticsPlayground({
	showHeader = true,
	showFooter = true,
	compact = false,
}: AnalyticsPlaygroundProps) {
	return (
		<div>
			{showHeader && (
				<div className="mb-8">
					<h1 className="text-4xl font-bold mb-2">Analytics Playground</h1>
					<p className="text-muted-foreground">
						Interact with the product page and watch events flow to multiple
						analytics providers in real-time
					</p>
				</div>
			)}

			{/* Main Grid */}
			<div
				className={
					compact
						? "grid grid-cols-1 md:grid-cols-2 gap-4"
						: "grid grid-cols-1 lg:grid-cols-3 gap-6"
				}
			>
				{/* Left Column - Product Demo */}
				<div className={compact ? "md:col-span-1" : "lg:col-span-1"}>
					<ProductDemo />
				</div>

				{/* Right Column - Event Log */}
				<div className={compact ? "md:col-span-1" : "lg:col-span-2"}>
					<div className={compact ? "h-[500px]" : "h-[calc(100vh-12rem)]"}>
						<EventLog />
					</div>
				</div>
			</div>

			{showFooter && (
				<div className="mt-8 p-6 bg-card rounded-lg border">
					<h3 className="font-semibold mb-3">How It Works</h3>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
						<div>
							<div className="font-medium text-primary mb-1">
								1. User Interaction
							</div>
							<p className="text-muted-foreground">
								Click, select, or interact with the product page elements
							</p>
						</div>
						<div>
							<div className="font-medium text-primary mb-1">
								2. Event Capture
							</div>
							<p className="text-muted-foreground">
								Analytics library captures the event with rich metadata
							</p>
						</div>
						<div>
							<div className="font-medium text-primary mb-1">
								3. Multi-Provider Sync
							</div>
							<p className="text-muted-foreground">
								Event is simultaneously sent to PostHog, Segment, and Mixpanel
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
