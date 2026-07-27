import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertRootBundleNeutral } from "./package-verification.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const invokedAsScript =
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const run = (command, args, cwd = root) =>
	execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });

export function assertDeclarationTargetsExist(distDirectory, relativeTargets) {
	for (const relativeTarget of relativeTargets) {
		if (!existsSync(join(distDirectory, relativeTarget))) {
			throw new Error(`missing declaration target ${relativeTarget}`);
		}
	}
}

export function assertMitPackageLicense(manifest, licenseText) {
	if (manifest.license !== "MIT") {
		throw new Error(
			`packed trakoo declares ${manifest.license ?? "no"} license`,
		);
	}
	if (
		typeof licenseText !== "string" ||
		!licenseText.startsWith("MIT License")
	) {
		throw new Error("packed trakoo LICENSE is not the MIT license");
	}
}

const consumerSource = String.raw`
import { defineEvents, noProperties, typed } from "trakoo";
import {
	AnalyticsValidationError as ClientValidationError,
	createClientAnalytics,
	type ClientAnalyticsConfig,
	type EventInputMap as ClientEventInputMap,
} from "trakoo/client";
import {
	createServerAnalytics,
	type ServerAnalyticsConfig,
} from "trakoo/server";

const events = defineEvents({
	clicked: {
		name: "clicked",
		category: "engagement",
		properties: typed<{ id: string }>(),
	},
	started: {
		name: "started",
		category: "user",
		properties: noProperties(),
	},
});

const analytics = createClientAnalytics({ events, providers: [] });
analytics.track("clicked", { id: "cta" });
analytics.track("started");

const serverAnalytics = createServerAnalytics({ events, providers: [] });
await serverAnalytics.track("clicked", { id: "server-cta" });
await serverAnalytics.track("started");

type ClickInput = ClientEventInputMap<typeof events>["clicked"];
void ({} as ClientAnalyticsConfig<typeof events>);
void ({} as ServerAnalyticsConfig<typeof events>);
void ({} as ClickInput);
void ClientValidationError;
`;

if (invokedAsScript) {
	const consumerDirectory = mkdtempSync(
		join(tmpdir(), "trakoo-package-consumer-"),
	);
	let tarballPath;

	try {
		run("pnpm", ["build"]);
		assertDeclarationTargetsExist(join(root, "dist"), [
			"index.d.ts",
			"client/index.d.ts",
			"server/index.d.ts",
			"adapters/server/server-analytics.d.ts",
		]);
		const packResult = JSON.parse(run("npm", ["pack", "--json"]));
		tarballPath = resolve(root, packResult[0].filename);

		run("npm", ["init", "-y"], consumerDirectory);
		run("npm", ["install", "--ignore-scripts", tarballPath], consumerDirectory);

		writeFileSync(join(consumerDirectory, "consumer.ts"), consumerSource);
		writeFileSync(
			join(consumerDirectory, "tsconfig.json"),
			JSON.stringify(
				{
					compilerOptions: {
						strict: true,
						noEmit: true,
						target: "ES2022",
						module: "ESNext",
						moduleResolution: "Bundler",
						moduleDetection: "force",
						skipLibCheck: true,
					},
					include: ["consumer.ts"],
				},
				null,
				2,
			),
		);
		run(
			process.execPath,
			[
				resolve(root, "node_modules/typescript/bin/tsc"),
				"--project",
				join(consumerDirectory, "tsconfig.json"),
			],
			consumerDirectory,
		);

		const installedManifest = JSON.parse(
			readFileSync(
				join(consumerDirectory, "node_modules/trakoo/package.json"),
				"utf8",
			),
		);
		assertMitPackageLicense(
			installedManifest,
			readFileSync(
				join(consumerDirectory, "node_modules/trakoo/LICENSE"),
				"utf8",
			),
		);
		if (!installedManifest.dependencies?.["@standard-schema/spec"]) {
			throw new Error(
				"packed trakoo is missing @standard-schema/spec dependency",
			);
		}
		const fontTypesManifest = JSON.parse(
			readFileSync(
				join(
					consumerDirectory,
					"node_modules/@types/css-font-loading-module/package.json",
				),
				"utf8",
			),
		);
		if (fontTypesManifest.version !== "0.0.13") {
			throw new Error(
				`packed consumer hoisted unexpected css font types ${fontTypesManifest.version}`,
			);
		}

		const concreteValidators = ["zod", "valibot", "arktype"];
		for (const field of [
			"dependencies",
			"optionalDependencies",
			"peerDependencies",
		]) {
			for (const packageName of concreteValidators) {
				if (installedManifest[field]?.[packageName]) {
					throw new Error(
						`packed trakoo declares concrete validator ${packageName}`,
					);
				}
			}
		}

		const installedDist = join(consumerDirectory, "node_modules/trakoo/dist");
		assertRootBundleNeutral(join(installedDist, "index.js"), installedDist, [
			...concreteValidators,
			"posthog-js",
			"posthog-node",
			"@openpanel/sdk",
			"@openpanel/web",
			"@bentonow/bento-node-sdk",
			"@emitkit/js",
		]);

		// Prove root event helpers load without optional provider packages present.
		run("npm", ["prune", "--omit=optional"], consumerDirectory);
		writeFileSync(
			join(consumerDirectory, "consumer.ts"),
			String.raw`
import { defineEvents, typed } from "trakoo";

defineEvents({
	checked: {
		name: "checked",
		category: "test",
		properties: typed<{ value: string }>(),
	},
});
`,
		);
		run(
			process.execPath,
			[
				resolve(root, "node_modules/typescript/bin/tsc"),
				"--project",
				join(consumerDirectory, "tsconfig.json"),
			],
			consumerDirectory,
		);
		run(
			process.execPath,
			["--input-type=module", "--eval", 'await import("trakoo")'],
			consumerDirectory,
		);
	} finally {
		if (tarballPath) rmSync(tarballPath, { force: true });
		rmSync(consumerDirectory, { recursive: true, force: true });
	}
}
