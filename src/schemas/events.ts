import { z } from "zod";

// We Assume that this data is available at ingestion time (from the edge models)
export const EventMetaSchema = z.object({
	vehicleSpeedInMilesPerHour: z.number().optional(),
	detectedLicensePlate: z.string().optional(),
	videoDurationInMs: z.number(),
});

export type EventMeta = z.infer<typeof EventMetaSchema>;
