import type { PaginatedResponse, PaginationParams } from "~/schemas/pagination";
import { PAGINATION } from "./constants";

const calculateLimitOffset = (paginationParams: PaginationParams) => {
	const { page, pageSize } = paginationParams;
	const offset = (page - PAGINATION.FIRST_PAGE) * pageSize;
	return { offset, limit: pageSize };
};

const calculateTotalPages = (totalCount: number, pageSize: number) => {
	return Math.ceil(totalCount / pageSize);
};

type PaginatedResponseArgs<ItemType> = {
	items: ItemType[];
	totalCount: number;
	pageSize: number;
	currentPage: number;
};

const createPaginatedResponse = <ItemType>(
	p: PaginatedResponseArgs<ItemType>,
): PaginatedResponse<ItemType> => {
	return {
		...p,
		totalPages: calculateTotalPages(p.totalCount, p.pageSize),
	};
};

export const PaginationUtils = {
	calculateLimitOffset,
	createPaginated: createPaginatedResponse,
};
