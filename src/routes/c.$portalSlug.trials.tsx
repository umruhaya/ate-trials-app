import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAuthenticated } from "~/lib/session";

export const Route = createFileRoute("/c/$portalSlug/trials")({
	component: () => <Outlet />,
	beforeLoad: requireAuthenticated(),
});
