import type { SQL } from "drizzle-orm";

export type FilterMappers<F, C> = {
	[K in keyof F]?: (value: NonNullable<F[K]>) => C | undefined;
};

const buildFilterConditions = <
	F extends Record<string, unknown>,
	C extends SQL<unknown>,
>(
	filters: F,
	mappers: FilterMappers<F, C>,
): C[] => {
	const conditions: C[] = [];

	for (const key of Object.keys(mappers) as (keyof F)[]) {
		const mapper = mappers[key];
		if (!mapper) continue;
		const value = filters[key];
		if (value !== undefined && value !== null) {
			const condition = mapper(value as NonNullable<F[typeof key]>);
			if (condition !== undefined) {
				conditions.push(condition);
			}
		}
	}

	return conditions;
};

export const SQLUtils = {
	buildFilterConditions,
};
