import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { requireAuthenticated } from "~/lib/session";
import { orpc } from "~/orpc/client";

export const Route = createFileRoute(
	"/c/$portalSlug/trials/$triallSlug/dashboard",
)({
	component: RouteComponent,
	beforeLoad: async (opts) => {
		const guard = requireAuthenticated();
		const result = await guard(opts);
		if (result.user.role !== "admin") {
			throw redirect({
				to: "/c/$portalSlug/trials/$triallSlug/events",
				params: {
					portalSlug: opts.params.portalSlug,
					triallSlug: opts.params.triallSlug,
				},
			});
		}
		return result;
	},
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			orpc.trials.dashboard.queryOptions({
				input: { id: params.triallSlug },
			}),
		);
	},
});

function RouteComponent() {
	const { portalSlug, triallSlug } = Route.useParams();
	const dashboardQuery = useQuery(
		orpc.trials.dashboard.queryOptions({
			input: { id: triallSlug },
		}),
	);

	if (dashboardQuery.isPending) {
		return (
			<div className="flex flex-col gap-8" aria-busy>
				<div className="h-9 w-72 max-w-full animate-pulse rounded-md bg-muted/60" />
				<div className="grid gap-4 sm:grid-cols-3">
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className="h-36 animate-pulse rounded-xl border border-border/60 bg-muted/40"
						/>
					))}
				</div>
				<div className="h-[320px] animate-pulse rounded-xl border border-border/60 bg-muted/30" />
				<div className="h-[320px] animate-pulse rounded-xl border border-border/60 bg-muted/30" />
			</div>
		);
	}

	if (dashboardQuery.isError || !dashboardQuery.data) {
		return (
			<div className="rounded-xl border border-dashed border-border px-4 py-12 text-center">
				<p className="font-medium text-(--sea-ink)">
					Could not load trial dashboard
				</p>
				<p className="mt-2 text-sm text-muted-foreground">
					The trial may have been removed or you may not have access.
				</p>
				<Link
					to="/c/$portalSlug/trials"
					params={{ portalSlug }}
					search={{}}
					className="mt-4 inline-block text-sm font-medium text-(--lagoon-deep) underline underline-offset-4 hover:text-(--sea-ink)"
				>
					Back to trials
				</Link>
			</div>
		);
	}

	const d = dashboardQuery.data;
	const lineData = d.deterrenceCurve.map((p) => ({
		trialDay: p.trialDay,
		date: p.date,
		verifiedViolations: p.verifiedViolations,
	}));
	const barData = d.threatMatrix;

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Completed trial dataset
					</p>
					<h1 className="display-title text-balance text-2xl font-semibold text-(--sea-ink) sm:text-3xl">
						{d.trialName}
					</h1>
					<p className="mt-1 max-w-2xl text-sm leading-snug text-muted-foreground">
						Verified violations and school-zone timing from historical review —
						not a live feed.
					</p>
				</div>
				<Link
					to="/c/$portalSlug/trials"
					params={{ portalSlug }}
					search={{}}
					className="shrink-0 text-sm font-medium text-(--lagoon-deep) underline-offset-4 hover:underline"
				>
					All trials
				</Link>
			</header>

			<section aria-labelledby="scorecard-heading">
				<h2 id="scorecard-heading" className="sr-only">
					Executive scorecard
				</h2>
				<ul className="grid list-none gap-4 p-0 sm:grid-cols-3">
					<li>
						<Card className="feature-card h-full border-border/80">
							<CardHeader className="pb-2">
								<CardDescription>Total events analyzed</CardDescription>
								<CardTitle className="font-mono text-3xl tabular-nums text-(--sea-ink)">
									{d.scorecard.totalEventsReviewed.toLocaleString()}
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0">
								<p className="text-xs text-muted-foreground">
									All trial-linked events in this period.
								</p>
							</CardContent>
						</Card>
					</li>
					<li>
						<Card className="feature-card h-full border-border/80">
							<CardHeader className="pb-2">
								<CardDescription>Verified violations</CardDescription>
								<CardTitle className="font-mono text-3xl tabular-nums text-(--sea-ink)">
									{d.scorecard.confirmedViolations.toLocaleString()}
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0">
								<p className="text-xs text-muted-foreground">
									Labeled violations after structured review (
									{d.scorecard.nonComplianceRate.toFixed(1)}% non-compliance).
								</p>
							</CardContent>
						</Card>
					</li>
					<li>
						<Card className="feature-card relative h-full overflow-hidden border-border/80">
							<span
								className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive"
								title="Kinematic risk (red light, failure to yield)"
							>
								<AlertTriangle className="size-3 shrink-0" aria-hidden />
								Danger
							</span>
							<CardHeader className="pb-2 pr-24">
								<CardDescription>Severe infractions</CardDescription>
								<CardTitle className="font-mono text-3xl tabular-nums text-(--sea-ink)">
									{d.scorecard.severeInfractions.toLocaleString()}
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0">
								<p className="text-xs text-muted-foreground">
									Red-light and failure-to-yield only.
								</p>
							</CardContent>
						</Card>
					</li>
				</ul>
			</section>

			<section
				className="feature-card rounded-xl border border-border/80 p-4 sm:p-6"
				aria-labelledby="deterrence-heading"
			>
				<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2
							id="deterrence-heading"
							className="text-lg font-semibold tracking-tight text-(--sea-ink)"
						>
							Deterrence curve
						</h2>
						<p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
							Daily verified violations across the trial window.
						</p>
					</div>
					<span className="inline-flex w-fit items-center rounded-full border border-chip-line bg-chip-bg px-2.5 py-1 text-xs font-medium text-(--sea-ink-soft)">
						Warning phase active (days 1–7: no citations)
					</span>
				</div>
				<div className="h-[min(380px,55vh)] w-full min-h-[280px]">
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={lineData}
							margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
						>
							<CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
							<XAxis
								dataKey="trialDay"
								tick={{ fill: "var(--sea-ink-soft)", fontSize: 11 }}
								label={{
									value: "Trial day",
									position: "insideBottom",
									offset: -4,
									fill: "var(--muted-foreground)",
								}}
							/>
							<YAxis
								width={44}
								allowDecimals={false}
								tick={{ fill: "var(--sea-ink-soft)", fontSize: 11 }}
								label={{
									value: "Violations",
									angle: -90,
									position: "insideLeft",
									fill: "var(--muted-foreground)",
								}}
							/>
							<Tooltip
								cursor={{ stroke: "var(--lagoon)", strokeWidth: 1 }}
								labelFormatter={(v) => {
									const row = lineData.find((r) => r.trialDay === v);
									const day = row?.date;
									return day ? `Day ${String(v)} · ${day}` : `Day ${String(v)}`;
								}}
								contentStyle={{
									background: "var(--card)",
									border: "1px solid var(--border)",
									borderRadius: "var(--radius)",
								}}
							/>
							<Line
								type="monotone"
								dataKey="verifiedViolations"
								name="Verified violations"
								stroke="var(--lagoon-deep)"
								strokeWidth={2}
								dot={false}
								activeDot={{ r: 5, fill: "var(--lagoon-deep)" }}
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
			</section>

			<section
				className="feature-card rounded-xl border border-border/80 p-4 sm:p-6"
				aria-labelledby="threat-heading"
			>
				<div className="mb-4">
					<h2
						id="threat-heading"
						className="text-lg font-semibold tracking-tight text-(--sea-ink)"
					>
						Threat matrix
					</h2>
					<p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
						School-zone violations by hour (local enforcement clock). Expect
						peaks near morning and afternoon school traffic.
					</p>
				</div>
				<div className="h-[min(380px,55vh)] w-full min-h-[280px]">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={barData}
							margin={{ top: 8, right: 8, left: 0, bottom: 32 }}
						>
							<CartesianGrid
								stroke="var(--line)"
								strokeDasharray="3 3"
								vertical={false}
							/>
							<XAxis
								dataKey="hourOfDay"
								angle={-45}
								textAnchor="end"
								height={56}
								interval={1}
								tick={{ fill: "var(--sea-ink-soft)", fontSize: 10 }}
								label={{
									value: "Hour",
									position: "insideBottom",
									offset: 0,
									fill: "var(--muted-foreground)",
								}}
							/>
							<YAxis
								width={44}
								allowDecimals={false}
								tick={{ fill: "var(--sea-ink-soft)", fontSize: 11 }}
								label={{
									value: "Violations",
									angle: -90,
									position: "insideLeft",
									fill: "var(--muted-foreground)",
								}}
							/>
							<Tooltip
								contentStyle={{
									background: "var(--card)",
									border: "1px solid var(--border)",
									borderRadius: "var(--radius)",
								}}
							/>
							<Bar
								dataKey="schoolZoneViolations"
								name="School zone violations"
								fill="var(--palm)"
								radius={[4, 4, 0, 0]}
								maxBarSize={28}
							/>
						</BarChart>
					</ResponsiveContainer>
				</div>
			</section>
		</div>
	);
}
