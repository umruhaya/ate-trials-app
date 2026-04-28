/**
 * Deterministic demo seed for B2G traffic-enforcement dashboard narratives.
 * Run from repo root: `pnpm db:seed`
 * Full wipe + reinsert: `pnpm db:seed -- --reset` (or `SEED_RESET=true pnpm db:seed`)
 */
import "./load-env.ts";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { faker } from "@faker-js/faker";
import type { EventMeta } from "~/schemas/events";
import type { StructuredAnnotation } from "~/schemas/structured-annotations";
import { db, table } from "./index.ts";

// -----------------------------------------------------------------------------
// Phase 1 — global configuration & tunable parameters
// -----------------------------------------------------------------------------

export const SEED_CONFIG = {
	/** Always passed to faker.seed — deterministic mock data for demos & screenshots. */
	SEED_CONSTANTS: 123,
	TRIAL_DAYS: 30,
	TOTAL_EVENTS_TARGET: 3000,
	/** Share of events that receive a StructuredAnnotation (pipeline throughput story). */
	PROCESSED_RATE: 0.9,
	/** Narrative anchor for school-zone spike charts (bell-adjacent peaks). */
	SCHOOL_ZONE_SPIKE_HOURS: [7, 8, 14, 15] as const,
} as const;

const MOCK_VIDEO_REF = "/mock-assets/sample-violation.mp4";

type DeploymentRow = typeof table.deployments.$inferInsert;
type ZoneType = DeploymentRow["zoneType"];

// -----------------------------------------------------------------------------
// Math helpers — curves & quotas
// -----------------------------------------------------------------------------

/**
 * Map exponential decay weights to integers that sum exactly to `targetSum`.
 * Used after geometric volumes so Drizzle inserts stay consistent with TOTAL_EVENTS_TARGET.
 */
function allocateIntegerShares(
	rawWeights: number[],
	targetSum: number,
): number[] {
	const sumRaw = rawWeights.reduce((a, b) => a + b, 0);
	const scaled = rawWeights.map((w) => (w / sumRaw) * targetSum);
	const floors = scaled.map((w) => Math.floor(w));
	const remainder = targetSum - floors.reduce((a, b) => a + b, 0);
	const fractional = scaled.map((w, i) => ({ i, frac: w - Math.floor(w) }));
	fractional.sort((a, b) => b.frac - a.frac);
	for (let k = 0; k < remainder; k++) {
		const idx = fractional[k]?.i ?? k % floors.length;
		floors[idx] += 1;
	}
	return floors;
}

/**
 * Deterrence decay: violations taper as drivers habituate (camera psychological effect).
 * Geometric sequence V_d = V0 * r^d with V29/V0 ≈ 15/200 so early rollout spikes, tail is quiet.
 */
function dailyEventCounts(): number[] {
	const ratioLastToFirst = 15 / 200;
	const r = ratioLastToFirst ** (1 / (SEED_CONFIG.TRIAL_DAYS - 1));
	const v0 =
		(SEED_CONFIG.TOTAL_EVENTS_TARGET * (1 - r)) /
		(1 - r ** SEED_CONFIG.TRIAL_DAYS);
	const raw = Array.from(
		{ length: SEED_CONFIG.TRIAL_DAYS },
		(_, d) => v0 * r ** d,
	);
	return allocateIntegerShares(raw, SEED_CONFIG.TOTAL_EVENTS_TARGET);
}

function mockBoundingBox() {
	return {
		x: faker.number.int({ min: 100, max: 800 }),
		y: faker.number.int({ min: 100, max: 600 }),
		width: faker.number.int({ min: 50, max: 200 }),
		height: faker.number.int({ min: 50, max: 200 }),
	};
}

function annotationData(): {
	videoTimestampInMs: number;
	boundingBox: { x: number; y: number; width: number; height: number };
} {
	return {
		videoTimestampInMs: faker.number.int({ min: 0, max: 180_000 }),
		boundingBox: mockBoundingBox(),
	};
}

/**
 * School zones: 75% inside AM/PM spike windows (drop-off / pickup kinematic risk).
 * Intersections: daytime spread + weighted evening rush (~17:00) for severity narrative.
 */
function randomEventTimestamp(dayWindowStart: Date, zoneType: ZoneType): Date {
	const ts = new Date(dayWindowStart);
	if (zoneType === "school-zone") {
		const inSpikeWindow = faker.number.float({ min: 0, max: 1 }) < 0.75;
		if (inSpikeWindow) {
			const morning = faker.number.int({ min: 0, max: 1 }) === 1;
			const minuteOfDay = morning
				? faker.number.int({ min: 7 * 60 + 30, max: 8 * 60 + 30 })
				: faker.number.int({ min: 14 * 60 + 30, max: 15 * 60 + 30 });
			ts.setHours(
				Math.floor(minuteOfDay / 60),
				minuteOfDay % 60,
				faker.number.int({ min: 0, max: 59 }),
				faker.number.int({ min: 0, max: 999 }),
			);
		} else {
			ts.setHours(
				faker.number.int({ min: 0, max: 23 }),
				faker.number.int({ min: 0, max: 59 }),
				faker.number.int({ min: 0, max: 59 }),
				faker.number.int({ min: 0, max: 999 }),
			);
		}
		return ts;
	}

	const roll = faker.number.float({ min: 0, max: 1 });
	let minuteOfDay: number;
	if (roll < 0.38) {
		minuteOfDay = faker.number.int({ min: 16 * 60, max: 19 * 60 });
	} else {
		minuteOfDay = faker.number.int({ min: 6 * 60, max: 22 * 60 });
	}
	ts.setHours(
		Math.floor(minuteOfDay / 60),
		minuteOfDay % 60,
		faker.number.int({ min: 0, max: 59 }),
		faker.number.int({ min: 0, max: 999 }),
	);
	return ts;
}

type ViolationKind =
	| "speeding-violation"
	| "failure-to-yield"
	| "red-light-violation";

function weightedViolationKind(detIdx: number): ViolationKind {
	const bucket = (detIdx * 7919 + SEED_CONFIG.SEED_CONSTANTS) % 100;
	if (bucket < 60) return "speeding-violation";
	if (bucket < 85) return "failure-to-yield";
	return "red-light-violation";
}

function buildStructuredAnnotation(
	kind: ViolationKind | "no-violation",
	isViolation: boolean,
): StructuredAnnotation {
	if (!isViolation || kind === "no-violation") {
		return { violation: { type: "no-violation" } };
	}

	const vehicleAnnotation = annotationData();

	switch (kind) {
		case "speeding-violation": {
			const speedLimit = faker.helpers.arrayElement([25, 35, 45]);
			return {
				violation: {
					type: "speeding-violation",
					vehicleAnnotation,
					speedLimit,
					actualSpeed: speedLimit + faker.number.int({ min: 8, max: 28 }),
				},
			};
		}
		case "failure-to-yield":
			return {
				violation: {
					type: "failure-to-yield",
					vehicleAnnotation,
					pedestrianAnnotation: annotationData(),
				},
			};
		case "red-light-violation":
			return {
				violation: {
					type: "red-light-violation",
					vehicleAnnotation,
					redLightAnnotation: annotationData(),
				},
			};
		default:
			return { violation: { type: "no-violation" } };
	}
}

function eventMetadata(): EventMeta {
	return {
		videoDurationInMs: faker.number.int({ min: 8_000, max: 120_000 }),
		vehicleSpeedInMilesPerHour: faker.number.int({ min: 18, max: 52 }),
		detectedLicensePlate: faker.string
			.alphanumeric({ length: 7 })
			.toUpperCase(),
	};
}

// -----------------------------------------------------------------------------
// Phase 2 — static entities
// -----------------------------------------------------------------------------

function createUsers() {
	const admin = {
		id: faker.string.uuid(),
		username: "traffic-admin",
		role: "admin" as const,
	};
	const annotator = {
		id: faker.string.uuid(),
		username: "traffic-annotator",
		role: "data-annotator" as const,
	};
	return { admin, annotator };
}

function createCommunityPortal(createdByUsername: string) {
	return {
		id: faker.string.uuid(),
		name: "Metro Traffic Safety Pilot",
		slug: "metro-traffic-pilot",
		description:
			"Community-facing transparency portal for automated enforcement trial metrics.",
		createdBy: createdByUsername,
		isActive: true,
	};
}

function createDeployments(): DeploymentRow[] {
	const zoneTypes: ZoneType[] = [
		"school-zone",
		"school-zone",
		"school-zone",
		"intersection",
		"intersection",
	];
	return zoneTypes.map((zoneType, i) => ({
		id: faker.string.uuid(),
		city: "Columbus",
		state: "OH",
		countryCode: "US",
		latitude: 39.96 + i * 0.002,
		longitude: -83.0 + i * 0.002,
		locationName:
			zoneType === "school-zone"
				? `Lincoln Elementary approach ${i + 1}`
				: `Main St / Oak Ave intersection ${i - 2}`,
		directionFacing: faker.helpers.arrayElement([
			"N",
			"S",
			"E",
			"W",
			"NE",
			"NW",
			"SE",
			"SW",
		]),
		zoneType,
		mountingPoint: faker.helpers.arrayElement([
			"mast-arm",
			"streetlight",
			"utility-pole",
			"pedestrian-beacon",
			"mobile-trailer",
		]),
		deviceId: `DEV-${faker.string.alphanumeric({ length: 8 }).toUpperCase()}`,
	}));
}

// -----------------------------------------------------------------------------
// Phase 4 — main execution (`seed()` + transaction)
// -----------------------------------------------------------------------------

/** Deterministic [0, modulo) from UUID — avoids correlating labels with deterrence day index. */
function stableModulo(input: string, modulo: number): number {
	let h = SEED_CONFIG.SEED_CONSTANTS >>> 0;
	for (let i = 0; i < input.length; i++) {
		h = Math.imul(31, h) + input.charCodeAt(i);
		h >>>= 0;
	}
	return h % modulo;
}

export type SeedOptions = {
	/** When true, deletes existing rows (FK-safe order) before inserting demo data. */
	reset?: boolean;
};

export async function seed(options?: SeedOptions) {
	const reset = options?.reset === true;

	faker.seed(SEED_CONFIG.SEED_CONSTANTS);

	const { admin, annotator } = createUsers();
	const portal = createCommunityPortal(admin.username);
	const deployments = createDeployments();

	const today = new Date();
	const endDate = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate(),
		23,
		59,
		59,
		999,
	);
	const startDate = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate() - (SEED_CONFIG.TRIAL_DAYS - 1),
	);
	startDate.setHours(0, 0, 0, 0);

	const trial = {
		id: faker.string.uuid(),
		title: "30-Day Automated Enforcement Trial",
		description:
			"Synthetic deterrence and temporal-risk narrative for dashboard evaluation.",
		createdBy: admin.username,
		isActive: true,
		communityPortalId: portal.id,
		startDate,
		endDate,
	};

	const dayCounts = dailyEventCounts();
	const annotateCount = Math.round(
		SEED_CONFIG.TOTAL_EVENTS_TARGET * SEED_CONFIG.PROCESSED_RATE,
	);

	await db.transaction(async (tx) => {
		if (reset) {
			await tx.delete(table.structuredAnnotations);
			await tx.delete(table.trialEvents);
			await tx.delete(table.events);
			await tx.delete(table.trials);
			await tx.delete(table.deployments);
			await tx.delete(table.communityPortals);
			await tx.delete(table.users);
		}

		await tx.insert(table.users).values([admin, annotator]);
		await tx.insert(table.communityPortals).values(portal);
		await tx.insert(table.deployments).values(deployments);
		await tx.insert(table.trials).values(trial);

		type PendingEvent = {
			id: string;
			deploymentId: string;
			timestamp: Date;
			metadata: EventMeta;
		};

		const pending: PendingEvent[] = [];

		for (let dayIdx = 0; dayIdx < SEED_CONFIG.TRIAL_DAYS; dayIdx++) {
			const count = dayCounts[dayIdx] ?? 0;
			const dayWindowStart = new Date(startDate);
			dayWindowStart.setDate(dayWindowStart.getDate() + dayIdx);

			for (let j = 0; j < count; j++) {
				const deployment = faker.helpers.arrayElement(deployments);
				const timestamp = randomEventTimestamp(
					dayWindowStart,
					deployment.zoneType,
				);
				pending.push({
					id: faker.string.uuid(),
					deploymentId: deployment.id,
					timestamp,
					metadata: eventMetadata(),
				});
			}
		}

		for (const batch of chunk(pending, 500)) {
			await tx.insert(table.events).values(
				batch.map((e) => ({
					id: e.id,
					externalBlobRef: MOCK_VIDEO_REF,
					timestamp: e.timestamp,
					deploymentId: e.deploymentId,
					metadata: e.metadata,
				})),
			);
			await tx
				.insert(table.trialEvents)
				.values(batch.map((e) => ({ eventId: e.id, trialId: trial.id })));
		}

		const sortedForAnnotation = [...pending].sort((a, b) =>
			a.id.localeCompare(b.id),
		);

		const annotationRows: (typeof table.structuredAnnotations.$inferInsert)[] =
			[];
		let violationOrdinal = 0;

		for (let i = 0; i < sortedForAnnotation.length; i++) {
			const ev = sortedForAnnotation[i];
			if (ev === undefined) continue;
			const takeAnnotation = i < annotateCount;
			if (!takeAnnotation) continue;

			const isViolation = stableModulo(`${ev.id}|vio`, 100) < 17;

			let payload: StructuredAnnotation;
			if (!isViolation) {
				payload = buildStructuredAnnotation("no-violation", false);
			} else {
				const kind = weightedViolationKind(violationOrdinal);
				violationOrdinal++;
				payload = buildStructuredAnnotation(kind, true);
			}

			annotationRows.push({
				id: faker.string.uuid(),
				eventId: ev.id,
				isViolation,
				annotation: payload,
				createdBy: annotator.username,
			});
		}

		for (const batch of chunk(annotationRows, 400)) {
			await tx.insert(table.structuredAnnotations).values(batch);
		}
	});

	return {
		reset,
		users: { admin: admin.username, annotator: annotator.username },
		portalSlug: portal.slug,
		trialId: trial.id,
		events: SEED_CONFIG.TOTAL_EVENTS_TARGET,
		annotations: annotateCount,
		schoolZoneSpikeHours: [...SEED_CONFIG.SCHOOL_ZONE_SPIKE_HOURS],
	};
}

function chunk<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		out.push(arr.slice(i, i + size));
	}
	return out;
}

function parseSeedCliResetFlag(): boolean {
	if (process.argv.includes("--reset")) return true;
	const v = process.env.SEED_RESET?.trim().toLowerCase();
	return v === "1" || v === "true" || v === "yes";
}

const thisFile = path.resolve(fileURLToPath(import.meta.url));
const argvScript =
	process.argv[1] !== undefined ? path.resolve(process.argv[1]) : "";

if (argvScript === thisFile) {
	const reset = parseSeedCliResetFlag();
	void seed({ reset })
		.then((summary) => {
			console.info("Seed complete:", summary);
			process.exit(0);
		})
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
