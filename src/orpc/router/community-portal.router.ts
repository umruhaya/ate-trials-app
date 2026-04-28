import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, or, sql } from "drizzle-orm";
import * as z from "zod";
import { db, table } from "~/db";
import { PaginationUtils } from "~/lib/pagination-utils";
import { SQLUtils } from "~/lib/sql-utils";
import { base } from "~/orpc/base";
import { createAuthMiddleware } from "~/orpc/middleware";

import {
	communityPortalFiltersSchema,
	communityPortalPaginatedSchema,
	communityPortalSchema,
} from "~/schemas/community-portal";

const requireAuthenticated = createAuthMiddleware({ role: "all" });
const requireAdmin = createAuthMiddleware({ role: "admin" });

export const getById = base
	.use(requireAuthenticated)
	.route({
		method: "GET",
		summary: "Get a community portal by ID or slug",
		path: "/community-portals/{+id}",
	})
	.input(z.object({ id: z.string().min(1) }))
	.output(communityPortalSchema)
	.errors({
		NOT_FOUND: {
			message: "Community portal not found",
		},
	})
	.handler(async ({ input, errors }) => {
		const row = await db
			.select()
			.from(table.communityPortals)
			.where(
				or(
					eq(table.communityPortals.id, input.id),
					eq(table.communityPortals.slug, input.id),
				),
			)
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
		path: "/community-portals",
	})
	.input(
		z.object({
			name: z.string().min(1),
			slug: z.string().min(1),
			description: z.string(),
		}),
	)
	.output(communityPortalSchema)
	.errors({
		CONFLICT: {
			status: 409,
			message: "A community portal with this slug already exists",
		},
	})
	.handler(async ({ context, input, errors }) => {
		const existing = await db
			.select({ id: table.communityPortals.id })
			.from(table.communityPortals)
			.where(eq(table.communityPortals.slug, input.slug))
			.limit(1)
			.then((r) => r[0]);
		if (existing) {
			errors.CONFLICT({
				message: `Community portal with slug "${input.slug}" already exists`,
			});
		}

		const id = crypto.randomUUID();
		await db.insert(table.communityPortals).values({
			id,
			name: input.name,
			slug: input.slug,
			description: input.description,
			createdBy: context.user.username,
		});
		const row = await db
			.select()
			.from(table.communityPortals)
			.where(eq(table.communityPortals.id, id))
			.then((r) => r[0]);
		if (!row) {
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
		return row;
	});

const updateInputSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1).optional(),
		slug: z.string().min(1).optional(),
		description: z.string().optional(),
		isActive: z.boolean().optional(),
	})
	.refine(
		(data) =>
			data.name !== undefined ||
			data.slug !== undefined ||
			data.description !== undefined ||
			data.isActive !== undefined,
		{ message: "At least one field must be provided to update" },
	);

export const update = base
	.use(requireAdmin)
	.route({
		method: "PATCH",
		path: "/community-portals/update",
	})
	.input(updateInputSchema)
	.output(communityPortalSchema)
	.handler(async ({ input }) => {
		const { id, name, slug, description, isActive } = input;
		const patch: Partial<{
			name: string;
			slug: string;
			description: string;
			isActive: boolean;
		}> = {};
		if (name !== undefined) patch.name = name;
		if (slug !== undefined) patch.slug = slug;
		if (description !== undefined) patch.description = description;
		if (isActive !== undefined) patch.isActive = isActive;

		await db
			.update(table.communityPortals)
			.set(patch)
			.where(eq(table.communityPortals.id, id));
		const row = await db
			.select()
			.from(table.communityPortals)
			.where(eq(table.communityPortals.id, id))
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
		path: "/community-portals",
	})
	.input(communityPortalFiltersSchema)
	.output(communityPortalPaginatedSchema)
	.handler(async ({ input }) => {
		const conditions = SQLUtils.buildFilterConditions(input, {
			slug: (value) =>
				sql`LOWER(${table.communityPortals.slug}) LIKE LOWER(${`%${value}%`})`,
			name: (value) =>
				sql`LOWER(${table.communityPortals.name}) LIKE LOWER(${`%${value}%`})`,
			isActive: (value) => eq(table.communityPortals.isActive, value),
			createdBy: (value) => eq(table.communityPortals.createdBy, value),
		});
		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const { offset, limit } = PaginationUtils.calculateLimitOffset(input);

		const [{ totalCount }] = await db
			.select({ totalCount: count() })
			.from(table.communityPortals)
			.where(whereClause);

		const items = await db
			.select()
			.from(table.communityPortals)
			.where(whereClause)
			.orderBy(desc(table.communityPortals.createdAt))
			.limit(limit)
			.offset(offset);

		return PaginationUtils.createPaginated({
			items,
			totalCount,
			pageSize: input.pageSize,
			currentPage: input.page,
		});
	});
