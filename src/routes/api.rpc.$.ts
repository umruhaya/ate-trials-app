import "~/polyfill";

import { createFileRoute } from "@tanstack/react-router";
import { rpcHandler } from "~/orpc/handlers";

async function handle({ request }: { request: Request }) {
	const { response } = await rpcHandler.handle(request, {
		prefix: "/api/rpc",
		context: { headers: request.headers },
	});

	return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			HEAD: handle,
			GET: handle,
			POST: handle,
			PUT: handle,
			PATCH: handle,
			DELETE: handle,
		},
	},
});
