import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import * as z from "zod";
import { db, table } from "~/db";
import { PaginationUtils } from "~/lib/pagination-utils";
import { SQLUtils } from "~/lib/sql-utils";
import { base } from "~/orpc/base";
import { createAuthMiddleware } from "~/orpc/middleware";
import {
	trialFiltersSchema,
	trialPaginatedSchema,
	trialSchema,
} from "~/schemas/trial";
import {
	DashboardDataSchema,
	type DeterrenceDataPoint,
	type ThreatMatrixDataPoint,
} from "~/schemas/trials-dashboard";

/** First N calendar days after trial start treat deterrence citations as advisory only. */
const WARNING_PHASE_DAYS = 7;

/** YYYY-MM-DD in UTC — matches SQLite `strftime(..., unixepoch)`. */
function utcIsoCalendarDate(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

function trialUtcStartMs(date: Date): number {
	return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

const requireAuthenticated = createAuthMiddleware({ role: "all" });
const requireAdmin = createAuthMiddleware({ role: "admin" });

async function resolvePortalId(portalRef: string) {
	const row = await db
		.select({ id: table.communityPortals.id })
		.from(table.communityPortals)
		.where(
			or(
				eq(table.communityPortals.id, portalRef),
				eq(table.communityPortals.slug, portalRef),
			),
		)
		.limit(1)
		.then((r) => r[0]);
	return row?.id ?? null;
}

const createTrialInputSchema = z
	.object({
		portalSlug: z.string().min(1),
		title: z.string().min(1),
		description: z.string(),
		startDate: z.coerce.date(),
		endDate: z.coerce.date(),
		/** Deployment (location) ids — events from these deployments in [startDate, endDate] link to the trial. */
		locationIds: z.array(z.string().min(1)),
	})
	.refine((data) => data.endDate >= data.startDate, {
		message: "endDate must be on or after startDate",
		path: ["endDate"],
	});

export const getById = base
	.use(requireAuthenticated)
	.route({
		method: "GET",
		path: "/trials/{+id}",
	})
	.input(z.object({ id: z.string().min(1) }))
	.output(trialSchema)
	.errors({
		NOT_FOUND: {
			message: "Trial not found",
		},
	})
	.handler(async ({ input, errors }) => {
		const row = await db
			.select()
			.from(table.trials)
			.where(eq(table.trials.id, input.id))
			.then((r) => r[0]);
		if (!row) {
			errors.NOT_FOUND();
		}
		return row;
	});

export const create = base
	.use(requireAdmin)
	.route({
		method: "POST",
		path: "/trials",
	})
	.input(createTrialInputSchema)
	.output(trialSchema)
	.errors({
		NOT_FOUND: {
			message: "Community portal not found",
		},
		BAD_REQUEST: {
			status: 400,
			message: "Invalid trial payload",
		},
	})
	.handler(async ({ context, input, errors }) => {
		const communityPortalId = await resolvePortalId(input.portalSlug);
		if (!communityPortalId) {
			errors.NOT_FOUND();
		}

		const uniqueLocationIds = [...new Set(input.locationIds)];
		if (uniqueLocationIds.length > 0) {
			const deploymentsFound = await db
				.select({ id: table.deployments.id })
				.from(table.deployments)
				.where(inArray(table.deployments.id, uniqueLocationIds));
			if (deploymentsFound.length !== uniqueLocationIds.length) {
				errors.BAD_REQUEST({
					message:
						"One or more location ids do not match an existing deployment",
				});
			}
		}

		const id = crypto.randomUUID();

		await db.transaction(async (tx) => {
			await tx.insert(table.trials).values({
				id,
				title: input.title,
				description: input.description,
				communityPortalId,
				createdBy: context.user.username,
				startDate: input.startDate,
				endDate: input.endDate,
			});

			if (uniqueLocationIds.length === 0) {
				return;
			}

			const matchingEvents = await tx
				.select({ id: table.events.id })
				.from(table.events)
				.where(
					and(
						inArray(table.events.deploymentId, uniqueLocationIds),
						gte(table.events.timestamp, input.startDate),
						lte(table.events.timestamp, input.endDate),
					),
				);

			if (matchingEvents.length === 0) {
				return;
			}

			await tx.insert(table.trialEvents).values(
				matchingEvents.map((e) => ({
					eventId: e.id,
					trialId: id,
				})),
			);
		});

		const row = await db
			.select()
			.from(table.trials)
			.where(eq(table.trials.id, id))
			.then((r) => r[0]);
		if (!row) {
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
		return row;
	});

const updateInputSchema = z
	.object({
		id: z.string().min(1),
		title: z.string().min(1).optional(),
		description: z.string().optional(),
		isActive: z.boolean().optional(),
	})
	.refine(
		(data) =>
			data.title !== undefined ||
			data.description !== undefined ||
			data.isActive !== undefined,
		{ message: "At least one field must be provided to update" },
	);

export const update = base
	.use(requireAdmin)
	.route({
		method: "PATCH",
		path: "/trials/update",
	})
	.input(updateInputSchema)
	.output(trialSchema)
	.handler(async ({ input }) => {
		const { id, title, description, isActive } = input;
		const patch: Partial<{
			title: string;
			description: string;
			isActive: boolean;
		}> = {};
		if (title !== undefined) patch.title = title;
		if (description !== undefined) patch.description = description;
		if (isActive !== undefined) patch.isActive = isActive;

		await db.update(table.trials).set(patch).where(eq(table.trials.id, id));
		const row = await db
			.select()
			.from(table.trials)
			.where(eq(table.trials.id, id))
			.then((r) => r[0]);
		if (!row) {
			throw new ORPCError("NOT_FOUND");
		}
		return row;
	});

export const list = base
	.use(requireAuthenticated)
	.route({
		method: "GET",
		path: "/trials",
	})
	.input(trialFiltersSchema)
	.output(trialPaginatedSchema)
	.errors({
		NOT_FOUND: {
			message: "Community portal not found",
		},
	})
	.handler(async ({ input, errors }) => {
		const communityPortalId = await resolvePortalId(input.portalSlug);
		if (!communityPortalId) {
			errors.NOT_FOUND();
		}

		const filterConditions = SQLUtils.buildFilterConditions(input, {
			title: (value) =>
				sql`LOWER(${table.trials.title}) LIKE LOWER(${`%${value}%`})`,
			description: (value) =>
				sql`LOWER(${table.trials.description}) LIKE LOWER(${`%${value}%`})`,
			isActive: (value) => eq(table.trials.isActive, value),
			createdBy: (value) => eq(table.trials.createdBy, value),
		});
		const portalScope = eq(table.trials.communityPortalId, communityPortalId);
		const whereClause =
			filterConditions.length > 0
				? and(portalScope, ...filterConditions)
				: portalScope;

		const { offset, limit } = PaginationUtils.calculateLimitOffset(input);

		const [{ totalCount }] = await db
			.select({ totalCount: count() })
			.from(table.trials)
			.where(whereClause);

		const items = await db
			.select()
			.from(table.trials)
			.where(whereClause)
			.orderBy(desc(table.trials.createdAt))
			.limit(limit)
			.offset(offset);

		return PaginationUtils.createPaginated({
			items,
			totalCount,
			pageSize: input.pageSize,
			currentPage: input.page,
		});
	});

/**
 * Verified violations keyed by calendar day (trial event local UTC date string YYYY-MM-DD).
 */
async function deterrenceViolationCountsByDate(
	trialId: string,
): Promise<Map<string, number>> {
	const rows = await db
		.select({
			dateKey:
				sql<string>`strftime('%Y-%m-%d', datetime(${table.events.timestamp}, 'unixepoch'))`.as(
					"day",
				),
			n: sql<number>`count(*)`.mapWith(Number),
		})
		.from(table.trialEvents)
		.innerJoin(table.events, eq(table.trialEvents.eventId, table.events.id))
		.innerJoin(
			table.structuredAnnotations,
			eq(table.structuredAnnotations.eventId, table.events.id),
		)
		.where(
			and(
				eq(table.trialEvents.trialId, trialId),
				eq(table.structuredAnnotations.isViolation, true),
			),
		)
		.groupBy(
			sql`strftime('%Y-%m-%d', datetime(${table.events.timestamp}, 'unixepoch'))`,
		);

	const map = new Map<string, number>();
	for (const row of rows) {
		map.set(row.dateKey, row.n);
	}
	return map;
}

/**
 * Verified violations in school-zone deployments by clock hour [0–23].
 */
async function threatMatrixViolationCountsByHour(
	trialId: string,
): Promise<Map<number, number>> {
	const rows = await db
		.select({
			hour: sql<number>`cast(strftime('%H', datetime(${table.events.timestamp}, 'unixepoch')) as integer)`.as(
				"hour",
			),
			n: sql<number>`count(*)`.mapWith(Number),
		})
		.from(table.trialEvents)
		.innerJoin(table.events, eq(table.trialEvents.eventId, table.events.id))
		.innerJoin(
			table.deployments,
			eq(table.events.deploymentId, table.deployments.id),
		)
		.innerJoin(
			table.structuredAnnotations,
			eq(table.structuredAnnotations.eventId, table.events.id),
		)
		.where(
			and(
				eq(table.trialEvents.trialId, trialId),
				eq(table.structuredAnnotations.isViolation, true),
				eq(table.deployments.zoneType, "school-zone"),
			),
		)
		.groupBy(
			sql`cast(strftime('%H', datetime(${table.events.timestamp}, 'unixepoch')) as integer)`,
		);

	const map = new Map<number, number>();
	for (const row of rows) {
		map.set(row.hour, row.n);
	}
	return map;
}

export const dashboard = base
	.use(requireAdmin)
	.route({
		method: "GET",
		path: "/trials/{+id}/dashboard",
	})
	.input(z.object({ id: z.string().min(1) }))
	.output(DashboardDataSchema)
	.errors({
		NOT_FOUND: {
			message: "Trial not found",
		},
	})
	.handler(async ({ input, errors }) => {
		const trial = await db
			.select()
			.from(table.trials)
			.where(eq(table.trials.id, input.id))
			.limit(1)
			.then((r) => r[0]);

		if (!trial) {
			errors.NOT_FOUND();
		}

		const [{ totalEventsReviewed }] = await db
			.select({ totalEventsReviewed: count() })
			.from(table.trialEvents)
			.where(eq(table.trialEvents.trialId, input.id));

		const [{ confirmedViolations }] = await db
			.select({ confirmedViolations: count() })
			.from(table.trialEvents)
			.innerJoin(table.events, eq(table.trialEvents.eventId, table.events.id))
			.innerJoin(
				table.structuredAnnotations,
				eq(table.structuredAnnotations.eventId, table.events.id),
			)
			.where(
				and(
					eq(table.trialEvents.trialId, input.id),
					eq(table.structuredAnnotations.isViolation, true),
				),
			);

		const [{ severeInfractions }] = await db
			.select({ severeInfractions: count() })
			.from(table.trialEvents)
			.innerJoin(table.events, eq(table.trialEvents.eventId, table.events.id))
			.innerJoin(
				table.structuredAnnotations,
				eq(table.structuredAnnotations.eventId, table.events.id),
			)
			.where(
				and(
					eq(table.trialEvents.trialId, input.id),
					eq(table.structuredAnnotations.isViolation, true),
					sql`json_extract(${table.structuredAnnotations.annotation}, '$.violation.type') in ('red-light-violation', 'failure-to-yield')`,
				),
			);

		const nonComplianceRate =
			totalEventsReviewed > 0
				? (confirmedViolations / totalEventsReviewed) * 100
				: 0;

		const startMs = trialUtcStartMs(trial.startDate);
		const endMs = trialUtcStartMs(trial.endDate);
		const trialDays =
			startMs <= endMs ? Math.floor((endMs - startMs) / 86_400_000) + 1 : 0;

		const dailyViolations =
			totalEventsReviewed > 0
				? await deterrenceViolationCountsByDate(input.id)
				: new Map<string, number>();

		const deterrenceCurve: DeterrenceDataPoint[] = [];
		for (let i = 0; i < trialDays; i++) {
			const dayMs = startMs + i * 86_400_000;
			const date = utcIsoCalendarDate(dayMs);
			const trialDayNum = i + 1;
			deterrenceCurve.push({
				trialDay: trialDayNum,
				date,
				verifiedViolations: dailyViolations.get(date) ?? 0,
				isWarningPhaseActive: trialDayNum <= WARNING_PHASE_DAYS,
			});
		}

		const hourlyCounts =
			totalEventsReviewed > 0
				? await threatMatrixViolationCountsByHour(input.id)
				: new Map<number, number>();

		const threatMatrix: ThreatMatrixDataPoint[] = [];
		for (let h = 0; h <= 23; h++) {
			threatMatrix.push({
				hourOfDay: `${String(h).padStart(2, "0")}:00`,
				schoolZoneViolations: hourlyCounts.get(h) ?? 0,
			});
		}

		return DashboardDataSchema.parse({
			trialId: trial.id,
			trialName: trial.title,
			scorecard: {
				totalEventsReviewed,
				confirmedViolations,
				severeInfractions,
				nonComplianceRate,
			},
			deterrenceCurve,
			threatMatrix,
		});
	});
