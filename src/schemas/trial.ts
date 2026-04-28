import * as z from "zod";
import { ZodUtils } from "~/lib/zod-utils";
import {
	createPaginatedResponseSchema,
	PaginationParamsSchema,
} from "~/schemas/pagination";

export const trialSchema = z.object({
	id: z.string(),
	title: z.string().trim().min(1, "Enter a title"),
	description: z.string(),
	createdBy: z.string(),
	isActive: z.boolean(),
	communityPortalId: z.string(),
	createdAt: z.date(),
});

export const trialSearchSchema = PaginationParamsSchema.extend({
	title: ZodUtils.searchStringOptional,
	description: ZodUtils.searchStringOptional,
	createdBy: ZodUtils.searchStringOptional,
	isActive: ZodUtils.searchBoolean,
});

export const trialFiltersSchema = trialSearchSchema.extend({
	portalSlug: z.string().min(1),
});

export const trialPaginatedSchema = createPaginatedResponseSchema(trialSchema);
