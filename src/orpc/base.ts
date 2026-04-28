import { os } from "@orpc/server";
import type { ResponseHeadersPluginContext } from "@orpc/server/plugins";
import type { table } from "~/db";

export type AuthenticatedUser = typeof table.users.$inferSelect;

export type BaseContext = {
	headers: Headers;
} & ResponseHeadersPluginContext;

/** RPC context after {@link createAuthMiddleware} from `~/orpc/middleware` runs */
export type AuthenticatedContext = BaseContext & {
	user: AuthenticatedUser;
};

export const base = os.$context<BaseContext>();

export const authenticated = os.$context<AuthenticatedContext>();
