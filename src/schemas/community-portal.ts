import * as z from "zod";
import {
	createPaginatedResponseSchema,
	PaginationParamsSchema,
} from "~/schemas/pagination";

export const communityPortalSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	description: z.string(),
	createdBy: z.string(),
	isActive: z.boolean(),
	createdAt: z.date(),
});

export const communityPortalFiltersSchema = PaginationParamsSchema.extend({
	slug: z.string().optional(),
	isActive: z.boolean().optional(),
	createdBy: z.string().optional(),
	name: z.string().optional(),
});

export const communityPortalPaginatedSchema = createPaginatedResponseSchema(
	communityPortalSchema,
);
