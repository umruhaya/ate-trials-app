import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAuthenticated } from "~/lib/session";

export const Route = createFileRoute(
	"/c/$portalSlug/trials/$triallSlug/events",
)({
	component: RouteComponent,
	beforeLoad: async (opts) => {
		const guard = requireAuthenticated();
		const result = await guard(opts);
		if (result.user.role !== "data-annotator") {
			throw redirect({
				to: "/c/$portalSlug/trials/$triallSlug/dashboard",
				params: {
					portalSlug: opts.params.portalSlug,
					triallSlug: opts.params.triallSlug,
				},
			});
		}
		return result;
	},
});

function RouteComponent() {
	return <div>Hello "/c/$portalSlug/trials/$triallSlug/events"!</div>;
}
