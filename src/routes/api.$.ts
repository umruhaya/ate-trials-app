import "~/polyfill";
import { createFileRoute } from "@tanstack/react-router";
import { openapiHandler } from "~/orpc/handlers";

async function handle({ request }: { request: Request }) {
	const { response } = await openapiHandler.handle(request, {
		prefix: "/api",
		context: { headers: request.headers },
	});

	return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/$")({
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
