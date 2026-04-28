import { and, asc, count, gte, lte } from "drizzle-orm";
import { db, table } from "~/db";
import { PaginationUtils } from "~/lib/pagination-utils";
import { base } from "~/orpc/base";
import { createAuthMiddleware } from "~/orpc/middleware";
import {
	locationFiltersSchema,
	locationPaginatedSchema,
	locationSchema,
	locationsStatsInputSchema,
	locationsStatsOutputSchema,
	locationWithStatsSchema,
} from "~/schemas/location";

const requireAuthenticated = createAuthMiddleware({ role: "all" });

export const list = base
	.use(requireAuthenticated)
	.route({
		method: "GET",
		path: "/locations",
	})
	.input(locationFiltersSchema)
	.output(locationPaginatedSchema)
	.handler(async ({ input }) => {
		const [{ totalCount }] = await db
			.select({ totalCount: count() })
			.from(table.deployments);

		const { offset, limit } = PaginationUtils.calculateLimitOffset(input);

		const items = await db
			.select()
			.from(table.deployments)
			.orderBy(asc(table.deployments.locationName))
			.limit(limit)
			.offset(offset);

		return PaginationUtils.createPaginated({
			items: items.map((row) => locationSchema.parse(row)),
			totalCount,
			pageSize: input.pageSize,
			currentPage: input.page,
		});
	});

/** For each deployment (“location”), counts events whose timestamps fall in `[startDate, endDate]`. */
export const stats = base
	.use(requireAuthenticated)
	.route({
		method: "GET",
		path: "/locations/stats",
	})
	.input(locationsStatsInputSchema)
	.output(locationsStatsOutputSchema)
	.handler(async ({ input }) => {
		const deployments = await db
			.select()
			.from(table.deployments)
			.orderBy(asc(table.deployments.locationName));

		const counts = await db
			.select({
				deploymentId: table.events.deploymentId,
				eventCount: count(),
			})
			.from(table.events)
			.where(
				and(
					gte(table.events.timestamp, input.startDate),
					lte(table.events.timestamp, input.endDate),
				),
			)
			.groupBy(table.events.deploymentId);

		const countByDeployment = new Map(
			counts.map((c) => [c.deploymentId, c.eventCount]),
		);

		return {
			startDate: input.startDate,
			endDate: input.endDate,
			locations: deployments.map((d) =>
				locationWithStatsSchema.parse({
					...d,
					eventCount: countByDeployment.get(d.id) ?? 0,
				}),
			),
		};
	});
