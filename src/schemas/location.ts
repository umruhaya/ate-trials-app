import * as z from "zod";
import {
	createPaginatedResponseSchema,
	PaginationParamsSchema,
} from "~/schemas/pagination";

/** Deployment row exposed as a “location” for dashboards and filters. */
export const locationSchema = z.object({
	id: z.string(),
	city: z.string(),
	state: z.string(),
	countryCode: z.string(),
	latitude: z.number(),
	longitude: z.number(),
	locationName: z.string(),
	directionFacing: z.enum(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]),
	zoneType: z.enum(["intersection", "crosswalk", "mid-block", "school-zone"]),
	mountingPoint: z.enum([
		"mast-arm",
		"streetlight",
		"utility-pole",
		"pedestrian-beacon",
		"mobile-trailer",
	]),
	deviceId: z.string(),
});

export const locationFiltersSchema = PaginationParamsSchema.extend({});

export const locationPaginatedSchema =
	createPaginatedResponseSchema(locationSchema);

export const locationWithStatsSchema = locationSchema.extend({
	eventCount: z.number().int().min(0),
});

export const locationsStatsInputSchema = z
	.object({
		startDate: z.coerce.date(),
		endDate: z.coerce.date(),
	})
	.refine((d) => d.endDate >= d.startDate, {
		message: "endDate must be on or after startDate",
		path: ["endDate"],
	});

export const locationsStatsOutputSchema = z.object({
	startDate: z.date(),
	endDate: z.date(),
	locations: z.array(locationWithStatsSchema),
});
