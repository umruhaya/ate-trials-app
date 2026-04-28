import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Filter, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
	type CommunityPortalForModal,
	CommunityPortalModal,
} from "~/components/community-portal.modal";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { PAGINATION } from "~/lib/constants";
import { requireAuthenticated } from "~/lib/session";
import { orpc } from "~/orpc/client";
import { communityPortalFiltersSchema } from "~/schemas/community-portal";

export const Route = createFileRoute("/community-portals")({
	component: RouteComponent,
	validateSearch: communityPortalFiltersSchema,
	search: {
		middlewares: [
			({ search, next }) =>
				next({
					...search,
					isActive: search.isActive ?? true,
				}),
		],
	},
	beforeLoad: requireAuthenticated(),
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const mode = context.user.role === "admin" ? "edit" : "view";
		await context.queryClient.ensureQueryData(
			orpc.communityPortal.list.queryOptions({ input: deps }),
		);
		return { mode };
	},
});

function RouteComponent() {
	const { mode } = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const [filterDraft, setFilterDraft] = useState({
		name: search.name,
		slug: search.slug,
		createdBy: search.createdBy,
		isActive: search.isActive,
	});
	useEffect(() => {
		setFilterDraft({
			name: search.name,
			slug: search.slug,
			createdBy: search.createdBy,
			isActive: search.isActive,
		});
	}, [search.name, search.slug, search.createdBy, search.isActive]);

	const listQuery = useQuery(
		orpc.communityPortal.list.queryOptions({
			input: search,
		}),
	);

	const items = listQuery.data?.items ?? [];
	const totalCount = listQuery.data?.totalCount ?? 0;
	const totalPages = listQuery.data?.totalPages ?? 1;
	const currentPage = listQuery.data?.currentPage ?? search.page;

	const [portalModalOpen, setPortalModalOpen] = useState(false);
	const [editingPortal, setEditingPortal] =
		useState<CommunityPortalForModal | null>(null);
	const [filtersOpen, setFiltersOpen] = useState(false);

	function applyFilters() {
		void navigate({
			search: {
				...search,
				page: PAGINATION.FIRST_PAGE,
				name: filterDraft.name,
				slug: filterDraft.slug,
				createdBy: filterDraft.createdBy,
				isActive: filterDraft.isActive,
			},
		});
	}

	function clearFilters() {
		setFilterDraft({
			name: undefined,
			slug: undefined,
			createdBy: undefined,
			isActive: undefined,
		});
		void navigate({
			search: {
				page: PAGINATION.FIRST_PAGE,
				pageSize: search.pageSize,
			},
		});
	}

	function goToPage(nextPage: number) {
		if (nextPage < 1 || nextPage > totalPages) return;
		void navigate({
			search: {
				...search,
				page: nextPage,
			},
		});
	}

	function setPageSize(nextSize: number) {
		void navigate({
			search: {
				...search,
				page: PAGINATION.FIRST_PAGE,
				pageSize: nextSize,
			},
		});
	}

	const hasFilters = Object.values({
		name: search.name,
		slug: search.slug,
		createdBy: search.createdBy,
		isActive: search.isActive,
	}).some(Boolean);

	return (
		<div className="page-wrap min-h-screen py-10">
			<div className="mx-auto flex max-w-6xl flex-col gap-8 px-4">
				<div className="border-b border-border/60 pb-6">
					<div>
						<p className="island-kicker mb-2">Directories</p>
						<h1 className="display-title text-balance text-3xl font-semibold text-(--sea-ink)">
							Community portals
						</h1>
						<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
							Browse portals you can join. Admins can add new portals from this
							page.
						</p>
					</div>
					<div className="mt-6 flex flex-wrap items-center justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							aria-expanded={filtersOpen}
							aria-controls="community-portal-filters"
							aria-label={filtersOpen ? "Hide filters" : "Show filters"}
							onClick={() => setFiltersOpen((open) => !open)}
						>
							<Filter className="size-4" aria-hidden />
						</Button>
						{mode === "edit" ? (
							<>
								<Button
									type="button"
									size="sm"
									className="gap-1.5"
									onClick={() => {
										setEditingPortal(null);
										setPortalModalOpen(true);
									}}
								>
									<Plus className="size-4" aria-hidden />
									New portal
								</Button>
								<CommunityPortalModal
									open={portalModalOpen}
									onOpenChange={(open) => {
										setPortalModalOpen(open);
										if (!open) {
											setEditingPortal(null);
										}
									}}
									editingPortal={editingPortal}
								/>
							</>
						) : null}
					</div>
				</div>

				{filtersOpen ? (
					<section
						id="community-portal-filters"
						className="feature-card rounded-xl border border-border/80 p-4 sm:p-6"
						aria-labelledby="filters-heading"
					>
						<h2
							id="filters-heading"
							className="mb-4 text-sm font-semibold text-(--sea-ink)"
						>
							Filters
						</h2>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<div className="space-y-2">
								<Label htmlFor="filter-name">Name contains</Label>
								<Input
									id="filter-name"
									value={filterDraft.name ?? ""}
									onChange={(e) =>
										setFilterDraft((d) => ({
											...d,
											name: e.target.value || undefined,
										}))
									}
									placeholder="Search name"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="filter-slug">Slug contains</Label>
								<Input
									id="filter-slug"
									value={filterDraft.slug ?? ""}
									onChange={(e) =>
										setFilterDraft((d) => ({
											...d,
											slug: e.target.value || undefined,
										}))
									}
									placeholder="Search slug"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="filter-created">Created by</Label>
								<Input
									id="filter-created"
									value={filterDraft.createdBy ?? ""}
									onChange={(e) =>
										setFilterDraft((d) => ({
											...d,
											createdBy: e.target.value || undefined,
										}))
									}
									placeholder="Username"
								/>
							</div>
							<div className="space-y-2">
								<span className="block text-sm font-medium">Status</span>
								<Select
									value={
										filterDraft.isActive === undefined
											? "all"
											: filterDraft.isActive
												? "active"
												: "inactive"
									}
									onValueChange={(v) =>
										setFilterDraft((d) => ({
											...d,
											isActive: v === "all" ? undefined : v === "active",
										}))
									}
								>
									<SelectTrigger id="filter-status">
										<SelectValue placeholder="Any status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Any status</SelectItem>
										<SelectItem value="active">Active</SelectItem>
										<SelectItem value="inactive">Inactive</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="mt-4 flex flex-wrap gap-2">
							<Button
								type="button"
								size="sm"
								onClick={() => void applyFilters()}
							>
								Apply filters
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => void clearFilters()}
							>
								Clear
							</Button>
						</div>
					</section>
				) : null}

				{listQuery.isPending ? (
					<>
						<p className="sr-only">Loading community portals.</p>
						<div
							className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
							aria-busy={true}
						>
							{Array.from({ length: search.pageSize }).map((_, i) => (
								<div
									key={`sk-${String(i)}`}
									className="h-44 animate-pulse rounded-xl border border-border/60 bg-muted/40"
								/>
							))}
						</div>
					</>
				) : items.length === 0 ? (
					<p className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-muted-foreground">
						{hasFilters
							? "No community portals match these filters."
							: "No community portals found."}
					</p>
				) : (
					<ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
						{items.map((portal) => (
							<li key={portal.id}>
								<Card className="feature-card h-full border-border/80 transition-shadow hover:shadow-md">
									<CardHeader className="gap-2">
										<div className="flex items-start justify-between gap-2">
											<CardTitle className="text-lg leading-snug text-(--sea-ink)">
												{portal.name}
											</CardTitle>
											<span
												className="shrink-0 rounded-full border border-chip-line bg-chip-bg px-2 py-0.5 text-xs font-medium text-(--sea-ink-soft)"
												data-active={portal.isActive}
											>
												{portal.isActive ? "Active" : "Inactive"}
											</span>
										</div>
										<CardDescription className="font-mono text-xs">
											/{portal.slug}
										</CardDescription>
									</CardHeader>
									<CardContent>
										<p className="line-clamp-3 min-h-[3lh] text-sm leading-5 text-muted-foreground">
											{portal.description || "—"}
										</p>
										<p className="mt-3 text-xs text-muted-foreground">
											Created by{" "}
											<span className="font-medium">{portal.createdBy}</span>
											{" · "}
											{new Date(portal.createdAt).toLocaleDateString(
												undefined,
												{
													dateStyle: "medium",
												},
											)}
										</p>
									</CardContent>
									<CardFooter className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row">
										{mode === "edit" ? (
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="w-full gap-1.5 sm:flex-1"
												onClick={() => {
													setEditingPortal({
														id: portal.id,
														name: portal.name,
														slug: portal.slug,
														description: portal.description,
														isActive: portal.isActive,
													});
													setPortalModalOpen(true);
												}}
											>
												<Pencil className="size-4" aria-hidden />
												Edit
											</Button>
										) : null}
										<Button
											variant="secondary"
											size="sm"
											className="w-full sm:flex-1"
											asChild
										>
											<Link
												to="/c/$portalSlug/trials"
												params={{ portalSlug: portal.slug }}
											>
												Open portal
											</Link>
										</Button>
									</CardFooter>
								</Card>
							</li>
						))}
					</ul>
				)}

				<nav
					className="flex flex-col gap-4 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between"
					aria-label="Pagination"
				>
					<p className="text-sm text-muted-foreground">
						Page {currentPage} of {totalPages}
						<span className="mx-1.5 text-border">·</span>
						{totalCount} {totalCount === 1 ? "portal" : "portals"}
					</p>
					<div className="flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">Per page</span>
							<Select
								value={String(search.pageSize)}
								onValueChange={(v) => setPageSize(Number(v))}
							>
								<SelectTrigger className="w-22" aria-label="Items per page">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[10, 20, 50].map((n) => (
										<SelectItem key={n} value={String(n)}>
											{n}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center gap-1">
							<Button
								type="button"
								variant="outline"
								size="icon-sm"
								aria-label="Previous page"
								disabled={currentPage <= 1 || listQuery.isPending}
								onClick={() => goToPage(currentPage - 1)}
							>
								<ChevronLeft className="size-4" />
							</Button>
							<Button
								type="button"
								variant="outline"
								size="icon-sm"
								aria-label="Next page"
								disabled={currentPage >= totalPages || listQuery.isPending}
								onClick={() => goToPage(currentPage + 1)}
							>
								<ChevronRight className="size-4" />
							</Button>
						</div>
					</div>
				</nav>
			</div>
		</div>
	);
}
