import {
	and,
	count,
	desc,
	eq,
	inArray,
	isNull,
	type SQL,
	sql,
} from "drizzle-orm";
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
import { StructuredAnnotationSchema } from "~/schemas/structured-annotations";

const requireAuthenticated = createAuthMiddleware({ role: "all" });

const annotateInputSchema = z.object({
	trialId: z.string().min(1),
	eventId: z.string().min(1),
	annotation: StructuredAnnotationSchema,
});

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

export const unprocessedForTrial = base
	.use(requireAuthenticated)
	.route({
		method: "GET",
		path: "/trials/{+trialId}/events/unprocessed",
	})
	.input(
		z.object({
			trialId: z.string().min(1),
			page: eventFiltersSchema.shape.page,
			pageSize: eventFiltersSchema.shape.pageSize,
		}),
	)
	.output(eventPaginatedSchema)
	.handler(async ({ input }) => {
		const whereClause = and(
			eq(table.trialEvents.trialId, input.trialId),
			isNull(table.structuredAnnotations.id),
		);

		const [{ totalCount }] = await db
			.select({ totalCount: count() })
			.from(table.trialEvents)
			.innerJoin(table.events, eq(table.trialEvents.eventId, table.events.id))
			.leftJoin(
				table.structuredAnnotations,
				eq(table.structuredAnnotations.eventId, table.events.id),
			)
			.where(whereClause);

		const { offset, limit } = PaginationUtils.calculateLimitOffset(input);
		const rows = await db
			.select({
				id: table.events.id,
				externalBlobRef: table.events.externalBlobRef,
				timestamp: table.events.timestamp,
				deploymentId: table.events.deploymentId,
				metadata: table.events.metadata,
			})
			.from(table.trialEvents)
			.innerJoin(table.events, eq(table.trialEvents.eventId, table.events.id))
			.leftJoin(
				table.structuredAnnotations,
				eq(table.structuredAnnotations.eventId, table.events.id),
			)
			.where(whereClause)
			.orderBy(desc(table.events.timestamp))
			.limit(limit)
			.offset(offset);

		return PaginationUtils.createPaginated({
			items: rows.map((row) => ({
				...eventRecordSchema.parse(row),
				processed: false,
			})),
			totalCount,
			pageSize: input.pageSize,
			currentPage: input.page,
		});
	});

export const annotate = base
	.use(requireAuthenticated)
	.route({
		method: "POST",
		path: "/events/annotate",
	})
	.input(annotateInputSchema)
	.output(z.object({ id: z.string(), eventId: z.string() }))
	.errors({
		NOT_FOUND: {
			message: "Event not found in this trial",
		},
		CONFLICT: {
			status: 409,
			message: "Event already has a structured annotation",
		},
	})
	.handler(async ({ context, input, errors }) => {
		const trialEvent = await db
			.select({ eventId: table.trialEvents.eventId })
			.from(table.trialEvents)
			.where(
				and(
					eq(table.trialEvents.trialId, input.trialId),
					eq(table.trialEvents.eventId, input.eventId),
				),
			)
			.limit(1)
			.then((r) => r[0]);

		if (!trialEvent) {
			errors.NOT_FOUND();
		}

		const existingAnnotation = await db
			.select({ id: table.structuredAnnotations.id })
			.from(table.structuredAnnotations)
			.where(eq(table.structuredAnnotations.eventId, input.eventId))
			.limit(1)
			.then((r) => r[0]);

		if (existingAnnotation) {
			errors.CONFLICT();
		}

		const id = crypto.randomUUID();
		await db.insert(table.structuredAnnotations).values({
			id,
			eventId: input.eventId,
			isViolation: input.annotation.violation.type !== "no-violation",
			annotation: input.annotation,
			createdBy: context.user.username,
		});

		return { id, eventId: input.eventId };
	});
