import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/c/$portalSlug")({
	component: RouteComponent,
});

function RouteComponent() {
	const { portalSlug } = Route.useParams();
	return <div>Hello Community Portal</div>;
}
