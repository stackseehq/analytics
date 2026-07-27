import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertRootBundleNeutral } from "../scripts/package-verification.mjs";
import {
	assertDeclarationTargetsExist,
	assertMitPackageLicense,
} from "../scripts/verify-package.mjs";

describe("packed license verification", () => {
	it("accepts MIT package metadata and license text", () => {
		expect(() =>
			assertMitPackageLicense(
				{ license: "MIT" },
				"MIT License\n\nPermission is hereby granted...",
			),
		).not.toThrow();
	});

	it("rejects non-MIT package metadata", () => {
		expect(() =>
			assertMitPackageLicense({ license: "ISC" }, "MIT License"),
		).toThrow("packed trakoo declares ISC license");
	});

	it("rejects missing or non-MIT packed license text", () => {
		expect(() => assertMitPackageLicense({ license: "MIT" })).toThrow(
			"packed trakoo LICENSE is not the MIT license",
		);
		expect(() =>
			assertMitPackageLicense({ license: "MIT" }, "ISC License"),
		).toThrow("packed trakoo LICENSE is not the MIT license");
	});
});

describe("packed root bundle verification", () => {
	it("reports a missing declaration target", () => {
		const distDirectory = mkdtempSync(
			join(tmpdir(), "trakoo-declaration-targets-"),
		);
		try {
			mkdirSync(join(distDirectory, "client"));
			writeFileSync(join(distDirectory, "index.d.ts"), "export {};\n");
			writeFileSync(join(distDirectory, "client/index.d.ts"), "export {};\n");

			expect(() =>
				assertDeclarationTargetsExist(distDirectory, [
					"index.d.ts",
					"client/index.d.ts",
					"server/index.d.ts",
				]),
			).toThrow("server/index.d.ts");
		} finally {
			rmSync(distDirectory, { recursive: true, force: true });
		}
	});

	it("scans only the complete root-reachable static import graph", () => {
		const distDirectory = mkdtempSync(join(tmpdir(), "trakoo-root-graph-"));
		try {
			mkdirSync(join(distDirectory, "chunks"));
			writeFileSync(
				join(distDirectory, "index.js"),
				'import"./chunks/registry.js";',
			);
			writeFileSync(
				join(distDirectory, "chunks/registry.js"),
				'import"../index.js";export*from"./validation.js";',
			);
			writeFileSync(
				join(distDirectory, "chunks/validation.js"),
				'import "@bentonow/bento-node-sdk";',
			);
			writeFileSync(join(distDirectory, "providers.js"), 'import "zod";');

			expect(() =>
				assertRootBundleNeutral(
					join(distDirectory, "index.js"),
					distDirectory,
					["zod", "@bentonow/bento-node-sdk"],
				),
			).toThrow(
				"root bundle includes @bentonow/bento-node-sdk in chunks/validation.js",
			);
		} finally {
			rmSync(distDirectory, { recursive: true, force: true });
		}
	});
});
