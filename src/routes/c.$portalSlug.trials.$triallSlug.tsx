import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/c/$portalSlug/trials/$triallSlug")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/c/$portalSlug/trials/$trialSlug"!</div>;
}
