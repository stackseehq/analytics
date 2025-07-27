/**
 * Environment detection utilities
 */

/**
 * Check if we're running in a browser environment
 * @returns true if running in browser, false if in Node.js or other environments
 */
export function isBrowser(): boolean {
	return typeof window !== "undefined" && typeof window.document !== "undefined";
}

/**
 * Check if we're running in a Node.js environment
 * @returns true if running in Node.js, false otherwise
 */
export function isNode(): boolean {
	return typeof process !== "undefined" && process.versions && !!process.versions.node;
}

/**
 * Check if we're running in a server-side rendering context
 * @returns true if likely in SSR context, false otherwise
 */
export function isSSR(): boolean {
	return !isBrowser() && typeof window === "undefined";
}