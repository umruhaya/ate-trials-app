import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, or, sql } from "drizzle-orm";
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
	.input(
		z.object({
			portalSlug: z.string().min(1),
			title: z.string().min(1),
			description: z.string(),
		}),
	)
	.output(trialSchema)
	.errors({
		NOT_FOUND: {
			message: "Community portal not found",
		},
	})
	.handler(async ({ context, input, errors }) => {
		const communityPortalId = await resolvePortalId(input.portalSlug);
		if (!communityPortalId) {
			errors.NOT_FOUND();
		}

		const id = crypto.randomUUID();
		await db.insert(table.trials).values({
			id,
			title: input.title,
			description: input.description,
			communityPortalId,
			createdBy: context.user.username,
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
