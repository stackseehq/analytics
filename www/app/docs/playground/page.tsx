import { AnalyticsPlayground } from "@/components/analytics-playground";

export default function PlaygroundPage() {
	return (
		<div className="min-h-screen">
			<div className="max-w-7xl mx-auto px-4 py-8">
				<AnalyticsPlayground />
			</div>
		</div>
	);
}

export const metadata = {
	title: "Analytics Playground",
	description: "Interactive demo of multi-provider analytics tracking",
};
