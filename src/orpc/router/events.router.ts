import { and, count, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import * as z from "zod";
import { db, table } from "~/db";
import { PaginationUtils } from "~/lib/pagination-utils";
import { base } from "~/orpc/base";
import { createAuthMiddleware } from "~/orpc/middleware";
import {
	eventDetailSchema,
	eventFiltersSchema,
	eventPaginatedSchema,
	eventRecordSchema,
} from "~/schemas/event-record";

const requireAuthenticated = createAuthMiddleware({ role: "all" });

function eventsWhereClause(filters: {
	trialId?: string;
	locationId?: string;
	processed?: boolean;
}): SQL | undefined {
	const parts: SQL[] = [];

	if (filters.trialId !== undefined && filters.trialId !== "") {
		parts.push(
			sql`exists (
				select 1 from trial_events te
				where te.event_id = ${table.events.id}
				  and te.trial_id = ${filters.trialId}
			)`,
		);
	}

	if (filters.locationId !== undefined && filters.locationId !== "") {
		parts.push(eq(table.events.deploymentId, filters.locationId));
	}

	if (filters.processed === true) {
		parts.push(
			sql`exists (
				select 1 from structured_annotations sa
				where sa.event_id = ${table.events.id}
			)`,
		);
	} else if (filters.processed === false) {
		parts.push(
			sql`not exists (
				select 1 from structured_annotations sa
				where sa.event_id = ${table.events.id}
			)`,
		);
	}

	if (parts.length === 0) return undefined;
	return parts.length === 1 ? parts[0] : and(...parts);
}

export const getById = base
	.use(requireAuthenticated)
	.route({
		method: "GET",
		path: "/events/{+id}",
	})
	.input(z.object({ id: z.string().min(1) }))
	.output(eventDetailSchema)
	.errors({
		NOT_FOUND: {
			message: "Event not found",
		},
	})
	.handler(async ({ input, errors }) => {
		const row = await db
			.select()
			.from(table.events)
			.where(eq(table.events.id, input.id))
			.limit(1)
			.then((r) => r[0]);

		if (!row) {
			errors.NOT_FOUND();
		}

		const eventRow = row as NonNullable<typeof row>;

		const annotation = await db
			.select({ id: table.structuredAnnotations.id })
			.from(table.structuredAnnotations)
			.where(eq(table.structuredAnnotations.eventId, eventRow.id))
			.limit(1)
			.then((r) => r[0]);

		const parsed = eventRecordSchema.parse(eventRow);

		return eventDetailSchema.parse({
			...parsed,
			processed: annotation !== undefined,
		});
	});

export const list = base
	.use(requireAuthenticated)
	.route({
		method: "GET",
		path: "/events",
	})
	.input(eventFiltersSchema)
	.output(eventPaginatedSchema)
	.handler(async ({ input }) => {
		const whereClause = eventsWhereClause({
			trialId: input.trialId,
			locationId: input.locationId,
			processed: input.processed,
		});

		const [{ totalCount }] = await (whereClause !== undefined
			? db.select({ totalCount: count() }).from(table.events).where(whereClause)
			: db.select({ totalCount: count() }).from(table.events));

		const { offset, limit } = PaginationUtils.calculateLimitOffset(input);

		const rows = await (whereClause !== undefined
			? db
					.select()
					.from(table.events)
					.where(whereClause)
					.orderBy(desc(table.events.timestamp))
					.limit(limit)
					.offset(offset)
			: db
					.select()
					.from(table.events)
					.orderBy(desc(table.events.timestamp))
					.limit(limit)
					.offset(offset));

		const ids = rows.map((r) => r.id);
		let annotatedIds = new Set<string>();
		if (ids.length > 0) {
			const annRows = await db
				.select({ eventId: table.structuredAnnotations.eventId })
				.from(table.structuredAnnotations)
				.where(inArray(table.structuredAnnotations.eventId, ids));
			annotatedIds = new Set(annRows.map((r) => r.eventId));
		}

		const items = rows.map((row) => {
			const parsed = eventRecordSchema.parse(row);
			return {
				...parsed,
				processed: annotatedIds.has(row.id),
			};
		});

		return PaginationUtils.createPaginated({
			items,
			totalCount,
			pageSize: input.pageSize,
			currentPage: input.page,
		});
	});
