import { z } from "zod";
import { PAGINATION } from "~/lib/constants";

export const PaginationParamsSchema = z.object({
	page: z.number().int().min(1).default(PAGINATION.FIRST_PAGE),
	pageSize: z.number().int().min(1).default(PAGINATION.DEFAULT_PAGE_SIZE),
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export function createPaginatedResponseSchema<ItemType extends z.ZodTypeAny>(
	itemSchema: ItemType,
) {
	return z.object({
		items: z.array(itemSchema),
		totalCount: z.number().int().min(0),
		pageSize: z.number().int().min(1),
		currentPage: z.number().int().min(1),
		totalPages: z.number().int().min(1),
	});
}

export type PaginatedResponse<ItemType> = {
	items: ItemType[];
	totalCount: number;
	currentPage: number;
	totalPages: number;
	pageSize: number;
};
