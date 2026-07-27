import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
	"www/content/docs/(Getting Started)/quick-start.mdx",
	"www/content/docs/guides/nextjs.mdx",
	"www/content/docs/guides/sveltekit.mdx",
	"www/content/docs/providers/posthog.mdx",
];

describe("server analytics lifecycle docs", () => {
	it.each(files)(
		"%s does not shut down a reusable singleton per request",
		(file) => {
			const source = readFileSync(file, "utf8");
			expect(source).not.toContain(
				"export const serverAnalytics = createServerAnalytics",
			);
			expect(source).toContain("function createRequestAnalytics");
			expect(source).toContain("await analytics.shutdown()");
		},
	);
});
