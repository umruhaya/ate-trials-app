import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Filter, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { type TrialForModal, TrialModal } from "~/components/trial.modal";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
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
import { trialSearchSchema } from "~/schemas/trial";

export const Route = createFileRoute("/c/$portalSlug/trials")({
	component: RouteComponent,
	validateSearch: trialSearchSchema,
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
	loader: async ({ context, deps: search, params }) => {
		const mode = context.user.role === "admin" ? "edit" : "view";
		await context.queryClient.ensureQueryData(
			orpc.trials.list.queryOptions({
				input: { ...search, portalSlug: params.portalSlug },
			}),
		);
		return { mode };
	},
});

function RouteComponent() {
	const { mode } = Route.useLoaderData();
	const { portalSlug } = Route.useParams();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const [filterDraft, setFilterDraft] = useState({
		title: search.title,
		description: search.description,
		createdBy: search.createdBy,
		isActive: search.isActive,
	});
	useEffect(() => {
		setFilterDraft({
			title: search.title,
			description: search.description,
			createdBy: search.createdBy,
			isActive: search.isActive,
		});
	}, [search.title, search.description, search.createdBy, search.isActive]);

	const listQuery = useQuery(
		orpc.trials.list.queryOptions({
			input: { ...search, portalSlug },
		}),
	);

	const items = listQuery.data?.items ?? [];
	const totalCount = listQuery.data?.totalCount ?? 0;
	const totalPages = listQuery.data?.totalPages ?? 1;
	const currentPage = listQuery.data?.currentPage ?? search.page;

	const [trialModalOpen, setTrialModalOpen] = useState(false);
	const [editingTrial, setEditingTrial] = useState<TrialForModal | null>(null);
	const [filtersOpen, setFiltersOpen] = useState(false);

	function applyFilters() {
		void navigate({
			search: {
				...search,
				page: PAGINATION.FIRST_PAGE,
				title: filterDraft.title,
				description: filterDraft.description,
				createdBy: filterDraft.createdBy,
				isActive: filterDraft.isActive,
			},
		});
	}

	function clearFilters() {
		setFilterDraft({
			title: undefined,
			description: undefined,
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
		title: search.title,
		description: search.description,
		createdBy: search.createdBy,
		isActive: search.isActive,
	}).some(Boolean);

	return (
		<div className="flex flex-col gap-4">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<h1 className="text-balance text-xl font-semibold tracking-tight text-(--sea-ink) sm:text-2xl">
						Trials
					</h1>
					<p className="mt-1 max-w-xl text-sm leading-snug text-muted-foreground">
						List and manage trials for this portal.
					</p>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						aria-expanded={filtersOpen}
						aria-controls="trial-filters"
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
									setEditingTrial(null);
									setTrialModalOpen(true);
								}}
							>
								<Plus className="size-4" aria-hidden />
								New trial
							</Button>
							<TrialModal
								open={trialModalOpen}
								onOpenChange={(open) => {
									setTrialModalOpen(open);
									if (!open) {
										setEditingTrial(null);
									}
								}}
								portalSlug={portalSlug}
								editingTrial={editingTrial}
							/>
						</>
					) : null}
				</div>
			</header>

			{filtersOpen ? (
				<section
					id="trial-filters"
					className="feature-card rounded-xl border border-border/80 p-4 sm:p-6"
					aria-labelledby="trial-filters-heading"
				>
					<h2
						id="trial-filters-heading"
						className="mb-4 text-sm font-semibold text-(--sea-ink)"
					>
						Filters
					</h2>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div className="space-y-2">
							<Label htmlFor="filter-trial-title">Title contains</Label>
							<Input
								id="filter-trial-title"
								value={filterDraft.title ?? ""}
								onChange={(e) =>
									setFilterDraft((d) => ({
										...d,
										title: e.target.value || undefined,
									}))
								}
								placeholder="Search title"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="filter-trial-description">
								Description contains
							</Label>
							<Input
								id="filter-trial-description"
								value={filterDraft.description ?? ""}
								onChange={(e) =>
									setFilterDraft((d) => ({
										...d,
										description: e.target.value || undefined,
									}))
								}
								placeholder="Search description"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="filter-trial-created">Created by</Label>
							<Input
								id="filter-trial-created"
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
								<SelectTrigger id="filter-trial-status">
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
						<Button type="button" size="sm" onClick={() => void applyFilters()}>
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
					<p className="sr-only">Loading trials.</p>
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
						? "No trials match these filters."
						: "No trials found for this portal."}
				</p>
			) : (
				<ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
					{items.map((trial) => (
						<li key={trial.id}>
							<Card className="feature-card h-full border-border/80 transition-shadow hover:shadow-md">
								<CardHeader className="gap-2">
									<div className="flex items-start justify-between gap-2">
										<CardTitle className="text-lg leading-snug text-(--sea-ink)">
											{trial.title}
										</CardTitle>
										<span
											className="shrink-0 rounded-full border border-chip-line bg-chip-bg px-2 py-0.5 text-xs font-medium text-(--sea-ink-soft)"
											data-active={trial.isActive}
										>
											{trial.isActive ? "Active" : "Inactive"}
										</span>
									</div>
								</CardHeader>
								<CardContent>
									<p className="line-clamp-3 min-h-[3lh] text-sm leading-5 text-muted-foreground">
										{trial.description || "—"}
									</p>
									<p className="mt-3 text-xs text-muted-foreground">
										Created by{" "}
										<span className="font-medium">{trial.createdBy}</span>
										{" · "}
										{new Date(trial.createdAt).toLocaleDateString(undefined, {
											dateStyle: "medium",
										})}
									</p>
								</CardContent>
								{mode === "edit" ? (
									<CardFooter className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row">
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="w-full gap-1.5 sm:flex-1"
											onClick={() => {
												setEditingTrial({
													id: trial.id,
													title: trial.title,
													description: trial.description,
													isActive: trial.isActive,
												});
												setTrialModalOpen(true);
											}}
										>
											<Pencil className="size-4" aria-hidden />
											Edit
										</Button>
									</CardFooter>
								) : null}
							</Card>
						</li>
					))}
				</ul>
			)}

			<nav
				className="flex flex-col gap-4 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between"
				aria-label="Pagination"
			>
				<p className="text-sm text-muted-foreground">
					Page {currentPage} of {totalPages}
					<span className="mx-1.5 text-border">·</span>
					{totalCount} {totalCount === 1 ? "trial" : "trials"}
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
	);
}
