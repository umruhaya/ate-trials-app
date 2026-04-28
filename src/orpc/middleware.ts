import { ORPCError } from "@orpc/server";
import { getCookie } from "@orpc/server/helpers";
import { eq } from "drizzle-orm";
import { db, table } from "~/db";
import { type AuthenticatedUser, base } from "~/orpc/base";

export type AuthRoleOption = "admin" | "data-annotator" | "all";

function isRoleAllowed(
	required: AuthRoleOption,
	userRole: AuthenticatedUser["role"],
): boolean {
	if (required === "all") return true;
	return userRole === required;
}

/**
 * Requires `user_id` cookie; optional role gate (`all` = any authenticated user).
 * Chain: `base.use(createAuthMiddleware({ role: 'admin' })).handler(...)` — `context` is `AuthenticatedContext` in `~/orpc/base`.
 */
export function createAuthMiddleware(options: { role: AuthRoleOption }) {
	return base.middleware(async ({ context, next }) => {
		const userId = getCookie(context.headers, "user_id");
		if (!userId) {
			throw new ORPCError("UNAUTHORIZED");
		}

		const user = await db
			.select()
			.from(table.users)
			.where(eq(table.users.id, userId))
			.then((r) => r[0]);

		if (!user) {
			throw new ORPCError("UNAUTHORIZED");
		}

		if (!isRoleAllowed(options.role, user.role)) {
			throw new ORPCError("FORBIDDEN");
		}

		const result = await next({
			context: { user },
		});

		return result;
	});
}
