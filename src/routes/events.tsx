import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "~/auth";
import { requireAuthenticated } from "~/lib/session";

export const Route = createFileRoute("/events")({
	component: RouteComponent,
	beforeLoad: requireAuthenticated("data-annotator"),
});

function RouteComponent() {
	const { user } = useAuth();

	return (
		<div className="page-wrap flex min-h-full flex-col items-center justify-center gap-6 py-12">
			<div className="flex w-full max-w-lg items-center justify-start">
				<h1 className="text-2xl font-semibold">Events</h1>
			</div>
			<p className="text-muted-foreground">
				Signed in as <strong>{user?.username}</strong> ({user?.role})
			</p>
		</div>
	);
}
