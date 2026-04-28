import type { QueryClient } from "@tanstack/react-query";
import { type ParsedLocation, redirect } from "@tanstack/react-router";
import { orpc } from "~/orpc/client";
import { ROUTES } from "./constants";

const SESSION_STALE_MS = 60_000;

export function currentUserQueryOptions() {
	return orpc.auth.getCurrentUser.queryOptions({
		staleTime: SESSION_STALE_MS,
	});
}

export function requireRole(role: "admin" | "data-annotator") {
	return async ({
		context,
		location,
	}: {
		context: { queryClient: QueryClient };
		location: ParsedLocation;
	}) => {
		const user = await context.queryClient.ensureQueryData(
			currentUserQueryOptions(),
		);
		if (!user) {
			throw redirect({
				to: ROUTES.HOME,
				search: { redirect: location.pathname },
			});
		}
		if (user.role !== role) {
			throw redirect({ to: ROUTES.DEFAULT(user.role) });
		}
	};
}
