import { z } from "zod";

// 1. Executive Scorecard Schema (The Baseline Reality)
export const ScorecardSchema = z.object({
	totalEventsReviewed: z.number(),
	confirmedViolations: z.number(),
	severeInfractions: z.number(), // Strictly red-light & failure-to-yield
	nonComplianceRate: z.number(), // (confirmedViolations / totalEventsReviewed) * 100
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

// The Grand Unified API Response
export const DashboardDataSchema = z.object({
	trialId: z.string(),
	trialName: z.string(),
	scorecard: ScorecardSchema,
	deterrenceCurve: z.array(DeterrenceDataPointSchema),
	threatMatrix: z.array(ThreatMatrixDataPointSchema),
});

// TypeScript Types for the Frontend
export type ScorecardData = z.infer<typeof ScorecardSchema>;
export type DeterrenceDataPoint = z.infer<typeof DeterrenceDataPointSchema>;
export type ThreatMatrixDataPoint = z.infer<typeof ThreatMatrixDataPointSchema>;
export type DashboardData = z.infer<typeof DashboardDataSchema>;
