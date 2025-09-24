import { defineConfig } from "vite";
import { resolve } from "node:path";
import dts from "vite-plugin-dts";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	return {
		cacheDir: "node_modules/.vite",
		build: {
			lib: {
				entry: {
					index: resolve(__dirname, "src/index.ts"),
					client: resolve(__dirname, "src/client.ts"),
					server: resolve(__dirname, "src/server.ts"),
					providers: resolve(__dirname, "src/providers/index.ts"),
				},
				formats: ["es"],
			},
			rollupOptions: {
				external: ["posthog-node", "posthog-js"],
			},
		},
		resolve: {
			alias: {
				"@": resolve("src/"),
			},
		},
		test: {
			globals: true,
			include: ["test/*.test.ts"],
		},
		plugins: [
			// generate typescript types
			dts({
				insertTypesEntry: true,
			}),
		],
		define: {
			"import.meta.vitest": mode !== "production",
		},
	};
});
