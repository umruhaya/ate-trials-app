import { z } from "zod";

const annotationData = z.object({
	videoTimestampInMs: z.number(),
	boundingBox: z.object({
		x: z.number(),
		y: z.number(),
		width: z.number(),
		height: z.number(),
	}),
});

const noViolation = z.object({ type: z.literal("no-violation") });

const failureToYield = z.object({
	type: z.literal("failure-to-yield"),
	vehicleAnnotation: annotationData,
	pedestrianAnnotation: annotationData,
});

const redLightViolation = z.object({
	type: z.literal("red-light-violation"),
	vehicleAnnotation: annotationData,
	redLightAnnotation: annotationData,
});

const speedingViolation = z.object({
	type: z.literal("speeding-violation"),
	vehicleAnnotation: annotationData,
	speedLimit: z.number(),
	actualSpeed: z.number(),
});

const distractedDrivingViolation = z.object({
	type: z.literal("distracted-driving-violation"),
	vehicleAnnotation: annotationData,
});

const stopSignViolation = z.object({
	type: z.literal("stop-sign-violation"),
	vehicleAnnotation: annotationData,
});

const seatbeltViolation = z.object({
	type: z.literal("seatbelt-violation"),
	vehicleAnnotation: annotationData,
});

export const StructuredAnnotationSchema = z.object({
	violation: z.union([
		noViolation,
		failureToYield,
		redLightViolation,
		speedingViolation,
		distractedDrivingViolation,
		stopSignViolation,
		seatbeltViolation,
	]),
});

export type StructuredAnnotation = z.infer<typeof StructuredAnnotationSchema>;
