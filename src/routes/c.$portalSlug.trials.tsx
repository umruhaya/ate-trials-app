import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/c/$portalSlug/trials")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/c/$portalSlug/trials"!</div>;
}
