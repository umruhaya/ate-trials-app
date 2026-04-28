import * as z from "zod";
import { ZodUtils } from "~/lib/zod-utils";
import { EventMetaSchema } from "~/schemas/events";
import {
	createPaginatedResponseSchema,
	PaginationParamsSchema,
} from "~/schemas/pagination";

/** Stored event row returned by the API (matches `events` table). */
export const eventRecordSchema = z.object({
	id: z.string(),
	externalBlobRef: z.string(),
	timestamp: z.date(),
	deploymentId: z.string(),
	metadata: EventMetaSchema,
});

/** Single-event fetch includes pipeline flag for annotations. */
export const eventDetailSchema = eventRecordSchema.extend({
	processed: z.boolean(),
});

/** Paginated list rows include `processed` for UI badges and filtering parity. */
export const eventListItemSchema = eventRecordSchema.extend({
	processed: z.boolean(),
});

export const eventFiltersSchema = PaginationParamsSchema.extend({
	trialId: ZodUtils.searchStringOptional,
	locationId: ZodUtils.searchStringOptional,
	processed: ZodUtils.searchBoolean,
});

export const eventPaginatedSchema =
	createPaginatedResponseSchema(eventListItemSchema);
