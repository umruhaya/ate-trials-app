import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/c/$portalSlug/trials/$triallSlug/events",
)({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/c/$portalSlug/trials/$triallSlug/events"!</div>;
}
