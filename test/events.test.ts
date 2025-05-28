import { describe, it, expect, expectTypeOf } from "vitest";
import type {
	CreateEventDefinition,
	EventCollection,
	ExtractEventNames,
	ExtractEventPropertiesFromCollection,
	PredefinedEventCategory,
} from "@/core/events";

describe("Event Types", () => {
	it("should allow creating event definitions with type safety", () => {
		const testEvent: CreateEventDefinition<"test_event", { userId: string }> = {
			name: "test_event",
			category: "user",
			properties: { userId: "123" },
		};

		expect(testEvent.name).toBe("test_event");
		expect(testEvent.category).toBe("user");
		expect(testEvent.properties.userId).toBe("123");
	});

	it("should allow custom event categories", () => {
		const customEvent: CreateEventDefinition<"custom_event"> = {
			name: "custom_event",
			category: "custom_category", // Custom category
			properties: {},
		};

		expect(customEvent.category).toBe("custom_category");
	});

	it("should extract event names from collection", () => {
		const TestEvents = {
			userSignedUp: {
				name: "user_signed_up",
				category: "user",
				properties: {} as { userId: string },
			},
			pageViewed: {
				name: "page_viewed",
				category: "navigation",
				properties: {} as { path: string },
			},
		} as const satisfies EventCollection<
			Record<string, CreateEventDefinition<string>>
		>;

		type EventNames = ExtractEventNames<typeof TestEvents>;

		// Type tests
		expectTypeOf<EventNames>().toEqualTypeOf<
			"user_signed_up" | "page_viewed"
		>();
	});

	it("should extract event properties from collection", () => {
		const TestEvents = {
			userSignedUp: {
				name: "user_signed_up",
				category: "user",
				properties: {} as { userId: string; email: string },
			},
			pageViewed: {
				name: "page_viewed",
				category: "navigation",
				properties: {} as { path: string; title?: string },
			},
		} as const satisfies EventCollection<
			Record<string, CreateEventDefinition<string>>
		>;

		type SignUpProps = ExtractEventPropertiesFromCollection<
			typeof TestEvents,
			"user_signed_up"
		>;
		type PageProps = ExtractEventPropertiesFromCollection<
			typeof TestEvents,
			"page_viewed"
		>;

		// Type tests
		expectTypeOf<SignUpProps>().toEqualTypeOf<{
			userId: string;
			email: string;
		}>();
		expectTypeOf<PageProps>().toEqualTypeOf<{ path: string; title?: string }>();
	});

	it("should have predefined event categories", () => {
		const categories: PredefinedEventCategory[] = [
			"user",
			"navigation",
			"error",
			"performance",
			"conversion",
			"engagement",
		];

		for (const category of categories) {
			const event: CreateEventDefinition<"test"> = {
				name: "test",
				category,
				properties: {},
			};
			expect(event.category).toBe(category);
		}
	});
});
