import * as z from "zod";
import { ZodUtils } from "~/lib/zod-utils";
import {
	createPaginatedResponseSchema,
	PaginationParamsSchema,
} from "~/schemas/pagination";

export const communityPortalSchema = z.object({
	id: z.string(),
	name: z.string().trim().min(1, "Enter a name"),
	slug: z
		.string()
		.trim()
		.min(4, "Slug must be at least 4 characters long")
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			"Lowercase letters, numbers, and single hyphens only",
		),
	description: z.string(),
	createdBy: z.string(),
	isActive: z.boolean(),
	createdAt: z.date(),
});

export const communityPortalFiltersSchema = PaginationParamsSchema.extend({
	slug: ZodUtils.searchStringOptional,
	isActive: ZodUtils.searchBoolean,
	createdBy: ZodUtils.searchStringOptional,
	name: ZodUtils.searchStringOptional,
});

export const communityPortalPaginatedSchema = createPaginatedResponseSchema(
	communityPortalSchema,
);
