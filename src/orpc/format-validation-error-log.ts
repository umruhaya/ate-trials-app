import type { StandardSchemaV1 } from "@standard-schema/spec";

type Issue = StandardSchemaV1.Issue;

function pathLabel(path: Issue["path"]): string {
	if (!path?.length) return "(root)";
	return path
		.map((segment) =>
			typeof segment === "object" && segment !== null && "key" in segment
				? String(segment.key)
				: String(segment),
		)
		.join(".");
}

function valueAtPath(data: unknown, path: Issue["path"]): unknown {
	if (path === undefined || path.length === 0) {
		return data;
	}
	let current: unknown = data;
	for (const segment of path) {
		const key =
			typeof segment === "object" && segment !== null && "key" in segment
				? segment.key
				: segment;
		if (current === null || typeof current !== "object") {
			return undefined;
		}
		current = (current as Record<PropertyKey, unknown>)[key as PropertyKey];
	}
	return current;
}

function serializeForLog(value: unknown): string {
	if (value === undefined) {
		return "undefined";
	}
	try {
		const s = JSON.stringify(
			value,
			(_k, v: unknown) => (v instanceof Date ? v.toISOString() : v),
			2,
		);
		const max = 4000;
		if (s === undefined) {
			return String(value);
		}
		if (s.length > max) {
			return `${s.slice(0, max)}\n… (truncated, ${s.length} chars total)`;
		}
		return s;
	} catch {
		return String(value);
	}
}

/**
 * Readable server log for Standard Schema validation failures attached as ORPCError.cause (ValidationError).
 */
export function formatValidationErrorCauseForLog(options: {
	phase: "output" | "input";
	label: string;
	issues: readonly Issue[];
	data: unknown;
}): string {
	const phase = options.phase === "output" ? "Output" : "Input";
	const lines = [
		`${phase} validation failed (${options.label})`,
		`Schema says (from validator messages below) vs value at path:`,
	];
	let i = 0;
	for (const issue of options.issues) {
		const at = pathLabel(issue.path);
		const got = valueAtPath(options.data, issue.path);
		lines.push(
			`  — [${i + 1}] path: ${at}`,
			`      expect: (${issue.message})`,
			`      got:    ${serializeForLog(got)}`,
		);
		i += 1;
	}
	lines.push(
		`  full payload (${options.phase === "output" ? "returned value" : "received value"}):`,
		serializeForLog(options.data),
	);
	return lines.join("\n");
}
