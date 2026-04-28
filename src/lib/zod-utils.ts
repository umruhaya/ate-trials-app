import { z } from "zod";

export namespace ZodUtils {
	// Strips whitespace and forces empty strings to undefined.
	// Accepts string | undefined as input, outputs string | undefined.
	export const searchStringOptional = z
		.string()
		.trim()
		.optional()
		.transform((val) => (val === "" ? undefined : val));

	// Explicitly handles actual booleans, stringified booleans, and nullish values.
	// Drops garbage inputs (like empty strings or invalid strings) safely to undefined.
	export const searchBoolean = z
		.union([
			z.boolean(),
			z.literal("true").transform(() => true),
			z.literal("false").transform(() => false),
		])
		.optional()
		.catch(undefined);

	export const searchInteger = z.coerce
		.number()
		.int()
		.min(1)
		.optional()
		.catch(undefined);
}
