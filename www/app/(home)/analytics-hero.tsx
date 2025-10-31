"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const ANALYTICS_PROVIDERS = [
	{
		name: "PostHog",
		domain: "posthog.com",
		position: "right-[calc(100%+63px)] top-0",
	},
	{
		name: "Segment",
		domain: "segment.com",
		position: "right-[calc(100%+195px)] top-[52px]",
	},
	{
		name: "Mixpanel",
		domain: "mixpanel.com",
		position: "right-[calc(100%+34px)] top-[144px]",
	},
	{
		name: "Amplitude",
		domain: "amplitude.com",
		position: "right-[calc(100%+268px)] top-[164px]",
	},
	{
		name: "Google Analytics",
		domain: "analytics.google.com",
		position: "right-[calc(100%+156px)] top-[240px]",
	},
	{
		name: "Heap",
		domain: "heap.io",
		position: "right-[calc(100%+242px)] top-[340px]",
	},
	{
		name: "Plausible",
		domain: "plausible.io",
		position: "right-[calc(100%+66px)] top-[366px]",
	},
	{
		name: "Matomo",
		domain: "matomo.org",
		position: "left-[calc(100%+53px)] top-0",
	},
	{
		name: "Umami",
		domain: "umami.is",
		position: "left-[calc(100%+202px)] top-[34px]",
	},
	{
		name: "Fathom",
		domain: "usefathom.com",
		position: "left-[calc(100%+97px)] top-[141px]",
	},
	{
		name: "Pirsch",
		domain: "pirsch.io",
		position: "left-[calc(100%+282px)] top-[138px]",
	},
	{
		name: "Simple Analytics",
		domain: "simpleanalytics.com",
		position: "left-[calc(100%+42px)] top-[262px]",
	},
	{
		name: "Bento",
		domain: "bentonow.com",
		position: "left-[calc(100%+234px)] top-[282px]",
	},
	{
		name: "June",
		domain: "june.so",
		position: "left-[calc(100%+112px)] top-[365px]",
	},
];

export function AnalyticsHero() {
	return (
		<section className="py-32">
			<div className="container flex flex-col items-center text-center">
				<div className="relative mx-auto flex max-w-3xl flex-col">
					{/* Floating Provider Icons */}
					{ANALYTICS_PROVIDERS.map((provider) => (
						<div
							key={provider.domain}
							className={`bg-accent ring-accent-foreground/10 absolute hidden size-[64px] rounded-2xl ring-1 ring-inset md:block ${provider.position}`}
						>
							<img
								src={`https://favicon.vemetric.com/${provider.domain}?size=64`}
								alt={provider.name}
								title={provider.name}
								className="h-full w-full object-contain object-center p-3"
							/>
						</div>
					))}

					{/* Hero Content */}
					<h1 className="my-6 text-pretty text-4xl font-bold lg:text-6xl">
						Type-Safe Analytics for Any Provider
					</h1>
					<p className="text-muted-foreground mb-8 max-w-3xl lg:text-xl">
						Track events with full type safety. One library that works with
						PostHog, Segment, Mixpanel, and 15+ other analytics services.
					</p>
					<div className="flex w-full flex-col justify-center gap-2 sm:flex-row">
						<Button asChild size="default" className="w-full sm:w-auto">
							<Link href="/docs/playground">Try Interactive Demo</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							size="default"
							className="w-full sm:w-auto"
						>
							<Link href="/docs/quick-start">Quick Start Guide</Link>
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
