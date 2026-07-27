/**
 * Compiles an event-name glob. Only `*` is special; every regex metacharacter
 * is treated literally.
 */
export function compileEventPattern(pattern: string): RegExp {
	if (typeof pattern !== "string") {
		throw new TypeError("Event pattern must be a string");
	}

	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
}
