import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
} from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { requireAuthenticated } from "~/lib/session";
import { orpc } from "~/orpc/client";

export const Route = createFileRoute("/c/$portalSlug")({
	component: RouteComponent,
	beforeLoad: requireAuthenticated(),
	loader: async ({ context, params }) => {
		try {
			const portal = await context.queryClient.ensureQueryData(
				orpc.communityPortal.getById.queryOptions({
					input: { id: params.portalSlug },
				}),
			);
			return { portal };
		} catch {
			// Re Throw notFound to trigger 404
			throw notFound();
		}
	},
});

function RouteComponent() {
	const { portal } = Route.useLoaderData();
	const portalQuery = useQuery(
		orpc.communityPortal.getById.queryOptions({
			input: { id: portal.id },
		}),
	);
	const displayPortal = portalQuery.data ?? portal;

	return (
		<div className="page-wrap py-4 sm:py-5">
			<div className="mx-auto max-w-6xl px-4">
				<nav
					className="mb-4 flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/60 pb-3 text-sm"
					aria-label="Portal context"
				>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 shrink-0 gap-1 px-2 -ml-2 text-muted-foreground hover:text-foreground"
						asChild
					>
						<Link to="/community-portals">
							<ChevronLeft className="size-4 shrink-0" aria-hidden />
							Community portals
						</Link>
					</Button>
					<span className="text-muted-foreground/50" aria-hidden>
						·
					</span>
					<span className="font-medium text-foreground">
						{displayPortal.name}
					</span>
					<span className="font-medium italic text-muted-foreground">
						/{displayPortal.slug}
					</span>
				</nav>
				<Outlet />
			</div>
		</div>
	);
}
