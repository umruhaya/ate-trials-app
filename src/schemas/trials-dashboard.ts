import { z } from "zod";

const ZoneTypeSchema = z.enum([
	"intersection",
	"crosswalk",
	"mid-block",
	"school-zone",
]);

// 1. Executive Scorecard Schema (The Baseline Reality)
export const ScorecardSchema = z.object({
	totalEventsAnalyzed: z.number(),
	annotatedEvents: z.number(),
	confirmedViolations: z.number(),
	severeInfractions: z.number(), // Strictly red-light & failure-to-yield
	violationRate: z.number(), // (confirmedViolations / annotatedEvents) * 100
	severeInfractionRate: z.number(), // (severeInfractions / confirmedViolations) * 100
});

// 2. Deterrence Curve Schema
export const DeterrenceDataPointSchema = z.object({
	trialDay: z.number(), // e.g., 1, 2, ..., 14
	date: z.string(), // ISO string date "2026-04-01"
	verifiedViolations: z.number(),
	isWarningPhaseActive: z.boolean(), // Critical business logic embedding
});

// 3. Threat Matrix Schema
// We specifically name this to reflect the pre-filtered school zone data
export const ThreatMatrixDataPointSchema = z.object({
	hourOfDay: z.string(), // e.g., "07:00", "08:00", "15:00"
	schoolZoneViolations: z.number(),
});

export const DashboardLocationSchema = z.object({
	id: z.string(),
	locationName: z.string(),
	city: z.string(),
	state: z.string(),
	zoneType: ZoneTypeSchema,
	directionFacing: z.enum(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]),
});

export const DashboardMetadataSchema = z.object({
	startDate: z.date(),
	endDate: z.date(),
	totalDays: z.number(),
	locations: z.array(DashboardLocationSchema),
});

export const ViolationDistributionDataPointSchema = z.object({
	violationType: z.string(),
	count: z.number(),
});

export const ZoneDistributionDataPointSchema = z.object({
	zoneType: ZoneTypeSchema,
	violations: z.number(),
});

// The Grand Unified API Response
export const DashboardDataSchema = z.object({
	trialId: z.string(),
	trialName: z.string(),
	metadata: DashboardMetadataSchema,
	scorecard: ScorecardSchema,
	deterrenceCurve: z.array(DeterrenceDataPointSchema),
	threatMatrix: z.array(ThreatMatrixDataPointSchema),
	violationDistribution: z.array(ViolationDistributionDataPointSchema),
	zoneDistribution: z.array(ZoneDistributionDataPointSchema),
});

// TypeScript Types for the Frontend
export type ScorecardData = z.infer<typeof ScorecardSchema>;
export type DeterrenceDataPoint = z.infer<typeof DeterrenceDataPointSchema>;
export type ThreatMatrixDataPoint = z.infer<typeof ThreatMatrixDataPointSchema>;
export type DashboardLocation = z.infer<typeof DashboardLocationSchema>;
export type DashboardMetadata = z.infer<typeof DashboardMetadataSchema>;
export type ViolationDistributionDataPoint = z.infer<
	typeof ViolationDistributionDataPointSchema
>;
export type ZoneDistributionDataPoint = z.infer<
	typeof ZoneDistributionDataPointSchema
>;
export type DashboardData = z.infer<typeof DashboardDataSchema>;
