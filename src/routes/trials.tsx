import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "~/auth";
import { Button } from "~/components/ui/button";
import { requireRole } from "~/lib/session";

export const Route = createFileRoute("/trials")({
	component: RouteComponent,
	beforeLoad: requireRole("admin"),
});

function RouteComponent() {
	const navigate = useNavigate();
	const { user, logout } = useAuth();

	async function handleLogout() {
		await logout();
		await navigate({ to: "/" });
	}

	return (
		<div className="page-wrap flex min-h-screen flex-col items-center justify-center gap-6 py-12">
			<div className="flex w-full max-w-lg items-center justify-between">
				<h1 className="text-2xl font-semibold">Trials</h1>
				<Button
					type="button"
					variant="outline"
					onClick={() => void handleLogout()}
				>
					Sign out
				</Button>
			</div>
			<p className="text-muted-foreground">
				Signed in as <strong>{user?.username}</strong> ({user?.role})
			</p>
		</div>
	);
}
