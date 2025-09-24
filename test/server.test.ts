import { describe, it, expect } from "vitest";
import * as ServerAnalytics from "@/server";

describe("@stacksee/analytics/server exports", () => {
	it("should export server analytics functions", () => {
		expect(ServerAnalytics.createServerAnalytics).toBeDefined();
		expect(ServerAnalytics.ServerAnalytics).toBeDefined();
	});
});