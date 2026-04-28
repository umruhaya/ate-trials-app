import { deleteCookie, getCookie, setCookie } from "@orpc/server/helpers";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { db, table } from "~/db";
import { base } from "~/orpc/base";

export const login = base
	.route({
		method: "POST",
		path: "/login",
	})
	.input(
		z.object({
			username: z.string(),
			role: z.enum(["admin", "data-annotator"]),
		}),
	)
	.handler(async ({ context, input }) => {
		await db
			.insert(table.users)
			.values({
				id: crypto.randomUUID(),
				username: input.username,
				role: input.role,
			})
			.onConflictDoNothing();

		const user = await db
			.select()
			.from(table.users)
			.where(eq(table.users.username, input.username))
			.then((r) => r[0]);

		setCookie(context.resHeaders, "user_id", user.id, {
			httpOnly: true,
			secure: true,
			sameSite: "strict",
			maxAge: 60 * 60 * 24 * 30,
		});

		return user;
	});

export const logout = base
	.route({
		method: "POST",
		path: "/logout",
	})
	.handler(async ({ context }) => {
		deleteCookie(context.resHeaders, "user_id", {
			httpOnly: true,
			secure: true,
			sameSite: "strict",
		});
		return "OK";
	});

export const getCurrentUser = base
	.route({
		method: "GET",
		path: "/current-user",
	})
	.handler(async ({ context }) => {
		const userId = getCookie(context.headers, "user_id");
		if (!userId) {
			return null;
		}
		const user = await db
			.select()
			.from(table.users)
			.where(eq(table.users.id, userId))
			.then((r) => r[0]);
		return user;
	});
