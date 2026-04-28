import { type Hotkey, useHotkeys } from "@tanstack/react-hotkeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	type AnnotationBox,
	AnnotationCanvas,
	type AnnotationEntity,
} from "~/components/annotation-canvas";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { requireAuthenticated } from "~/lib/session";
import { orpc } from "~/orpc/client";
import type { StructuredAnnotation } from "~/schemas/structured-annotations";

export const Route = createFileRoute(
	"/c/$portalSlug/trials/$triallSlug/events",
)({
	component: RouteComponent,
	beforeLoad: requireAuthenticated(),
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			orpc.events.unprocessedForTrial.queryOptions({
				input: {
					trialId: params.triallSlug,
					page: 1,
					pageSize: 25,
				},
			}),
		);
	},
});

type ViolationType = StructuredAnnotation["violation"]["type"];

const MOCK_VIDEO_SRC = "/sample-violation.mp4";

const ENTITY_LABELS: Record<AnnotationEntity, string> = {
	vehicle: "Vehicle",
	pedestrian: "Pedestrian",
	redLight: "Red light",
};

const OUTCOME_HOTKEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;

const ENTITY_HOTKEYS: Record<AnnotationEntity, Hotkey> = {
	vehicle: "V",
	pedestrian: "P",
	redLight: "L",
};

const VIOLATION_OPTIONS: Array<{
	type: ViolationType;
	label: string;
	requiredEntities: AnnotationEntity[];
	color: string;
}> = [
	{
		type: "no-violation",
		label: "No violation",
		requiredEntities: [],
		color: "#16a34a",
	},
	{
		type: "failure-to-yield",
		label: "Failure to yield",
		requiredEntities: ["vehicle", "pedestrian"],
		color: "#f59e0b",
	},
	{
		type: "red-light-violation",
		label: "Red light violation",
		requiredEntities: ["vehicle", "redLight"],
		color: "#ef4444",
	},
	{
		type: "speeding-violation",
		label: "Speeding",
		requiredEntities: ["vehicle"],
		color: "#2563eb",
	},
	{
		type: "distracted-driving-violation",
		label: "Distracted driving",
		requiredEntities: ["vehicle"],
		color: "#a855f7",
	},
	{
		type: "stop-sign-violation",
		label: "Stop sign violation",
		requiredEntities: ["vehicle"],
		color: "#dc2626",
	},
	{
		type: "seatbelt-violation",
		label: "Seatbelt violation",
		requiredEntities: ["vehicle"],
		color: "#0f766e",
	},
];

function OutcomeIcon({ type, color }: { type: ViolationType; color: string }) {
	const common = {
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round" as const,
		strokeLinejoin: "round" as const,
	};

	return (
		<span
			className="inline-flex size-8 items-center justify-center rounded-md text-white shadow-sm"
			style={{ backgroundColor: color }}
			aria-hidden
		>
			<svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
				{type === "no-violation" ? (
					<path {...common} d="m5 12 4 4L19 6" />
				) : type === "failure-to-yield" ? (
					<>
						<path {...common} d="M12 3 3 20h18L12 3Z" />
						<path {...common} d="M12 9v4" />
						<path {...common} d="M12 17h.01" />
					</>
				) : type === "red-light-violation" ? (
					<>
						<rect {...common} x="8" y="3" width="8" height="18" rx="3" />
						<circle cx="12" cy="8" r="2" fill="currentColor" />
						<circle cx="12" cy="13" r="2" fill="currentColor" opacity="0.45" />
						<circle cx="12" cy="18" r="2" fill="currentColor" opacity="0.45" />
					</>
				) : type === "speeding-violation" ? (
					<>
						<path {...common} d="M5 16a7 7 0 1 1 14 0" />
						<path {...common} d="m12 16 4-5" />
						<path {...common} d="M8 20h8" />
					</>
				) : type === "distracted-driving-violation" ? (
					<>
						<rect {...common} x="8" y="3" width="8" height="18" rx="2" />
						<path {...common} d="M11 18h2" />
					</>
				) : type === "stop-sign-violation" ? (
					<>
						<path {...common} d="M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5Z" />
						<path {...common} d="M9 12h6" />
					</>
				) : (
					<>
						<path
							{...common}
							d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"
						/>
						<path {...common} d="M9 12h6" />
						<path {...common} d="M12 9v6" />
					</>
				)}
			</svg>
		</span>
	);
}

function formatTime(ms: number) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function HotkeyBadge({ children }: { children: string }) {
	return (
		<kbd className="inline-flex min-w-5 items-center justify-center rounded border border-border/70 bg-background/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-muted-foreground shadow-xs">
			{children}
		</kbd>
	);
}

function RouteComponent() {
	const { portalSlug, triallSlug } = Route.useParams();
	const queryClient = useQueryClient();
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const lastEventIdRef = useRef<string | null>(null);
	const queueBaselineRef = useRef<number | null>(null);

	const eventsQuery = useQuery(
		orpc.events.unprocessedForTrial.queryOptions({
			input: {
				trialId: triallSlug,
				page: 1,
				pageSize: 25,
			},
		}),
	);

	const annotateMutation = useMutation(
		orpc.events.annotate.mutationOptions({
			onSuccess: async () => {
				resetAnnotationState();
				await queryClient.invalidateQueries({
					queryKey: orpc.events.unprocessedForTrial.key({ type: "query" }),
				});
			},
		}),
	);

	const currentEvent = eventsQuery.data?.items[0] ?? null;
	const totalUnprocessed = eventsQuery.data?.totalCount ?? 0;

	useEffect(() => {
		const data = eventsQuery.data;
		if (data === undefined) return;
		const n = data.totalCount;
		if (queueBaselineRef.current === null) {
			queueBaselineRef.current = n;
		} else if (n > queueBaselineRef.current) {
			queueBaselineRef.current = n;
		}
	}, [eventsQuery.data]);

	const queueBaseline = queueBaselineRef.current ?? totalUnprocessed;
	const completedInSession = Math.max(0, queueBaseline - totalUnprocessed);
	const queueProgressPercent =
		queueBaseline > 0
			? Math.min(100, (completedInSession / queueBaseline) * 100)
			: 0;
	const currentEventId = currentEvent?.id ?? null;
	const [selectedType, setSelectedType] = useState<ViolationType | null>(null);
	const [activeEntity, setActiveEntity] = useState<AnnotationEntity | null>(
		null,
	);
	const [boxes, setBoxes] = useState<AnnotationBox[]>([]);
	const [currentTimeMs, setCurrentTimeMs] = useState(0);
	const [durationMs, setDurationMs] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [speedLimit, setSpeedLimit] = useState("");
	const [actualSpeed, setActualSpeed] = useState("");

	const selectedConfig = useMemo(
		() => VIOLATION_OPTIONS.find((option) => option.type === selectedType),
		[selectedType],
	);
	const requiredEntities = selectedConfig?.requiredEntities ?? [];
	const missingEntities = requiredEntities.filter(
		(entity) => !boxes.some((box) => box.entity === entity),
	);
	const needsSpeed = selectedType === "speeding-violation";
	const speedLimitValue = Number(speedLimit);
	const actualSpeedValue = Number(actualSpeed);
	const speedReady =
		!needsSpeed ||
		(Number.isFinite(speedLimitValue) &&
			speedLimitValue > 0 &&
			Number.isFinite(actualSpeedValue) &&
			actualSpeedValue > 0);
	const canSubmit =
		currentEvent !== null &&
		selectedType !== null &&
		missingEntities.length === 0 &&
		speedReady &&
		!annotateMutation.isPending;

	useHotkeys(
		[
			...VIOLATION_OPTIONS.map((option, index) => ({
				hotkey: OUTCOME_HOTKEYS[index],
				callback: () => selectViolationType(option.type),
				options: {
					meta: {
						name: `Choose ${option.label}`,
						description: `Select ${option.label} as the event outcome`,
					},
				},
			})),
			...Object.entries(ENTITY_HOTKEYS).map(([entity, hotkey]) => ({
				hotkey,
				callback: () => setActiveEntity(entity as AnnotationEntity),
				options: {
					enabled: requiredEntities.includes(entity as AnnotationEntity),
					meta: {
						name: `Select ${ENTITY_LABELS[entity as AnnotationEntity]}`,
						description: "Choose the bounding box entity to draw next",
					},
				},
			})),
			{
				hotkey: "Space" as const,
				callback: () => togglePlayback(),
				options: {
					enabled: currentEvent !== null,
					meta: {
						name: "Play or pause video",
						description: "Toggle video playback while annotating",
					},
				},
			},
			{
				hotkey: "R" as const,
				callback: () => seekTo(0),
				options: {
					enabled: currentEvent !== null && durationMs > 0,
					meta: {
						name: "Restart video",
						description: "Seek the video back to the beginning",
					},
				},
			},
			{
				hotkey: "Enter" as const,
				callback: () => void submitAnnotation(),
				options: {
					enabled: canSubmit,
					meta: {
						name: "Finish event",
						description: "Submit the completed event annotation",
					},
				},
			},
		],
		{
			enabled: currentEvent !== null,
			preventDefault: true,
			stopPropagation: true,
		},
	);

	useEffect(() => {
		if (lastEventIdRef.current === currentEventId) return;
		lastEventIdRef.current = currentEventId;
		setSelectedType(null);
		setActiveEntity(null);
		setBoxes([]);
		setSpeedLimit("");
		setActualSpeed("");
		setCurrentTimeMs(0);
		setDurationMs(0);
		setIsPlaying(false);
		if (videoRef.current) {
			videoRef.current.pause();
			videoRef.current.currentTime = 0;
		}
	});

	function resetAnnotationState() {
		setSelectedType(null);
		setActiveEntity(null);
		setBoxes([]);
		setSpeedLimit("");
		setActualSpeed("");
	}

	function selectViolationType(type: ViolationType) {
		const config = VIOLATION_OPTIONS.find((option) => option.type === type);
		setSelectedType(type);
		setBoxes([]);
		setSpeedLimit("");
		setActualSpeed("");
		setActiveEntity(config?.requiredEntities[0] ?? null);
	}

	function beginDrawing() {
		const video = videoRef.current;
		if (video && !video.paused) {
			video.pause();
			setIsPlaying(false);
		}
		return Math.round((video?.currentTime ?? currentTimeMs / 1000) * 1000);
	}

	function addBox(box: Omit<AnnotationBox, "id">) {
		const nextBox = { ...box, id: crypto.randomUUID() };
		setBoxes((current) => [
			...current.filter((item) => item.entity !== box.entity),
			nextBox,
		]);

		const nextMissingEntity = requiredEntities.find(
			(entity) =>
				entity !== box.entity && !boxes.some((item) => item.entity === entity),
		);
		setActiveEntity(nextMissingEntity ?? box.entity);
	}

	function removeBox(id: string) {
		setBoxes((current) => current.filter((box) => box.id !== id));
	}

	function annotationDataFor(entity: AnnotationEntity) {
		const box = boxes.find((item) => item.entity === entity);
		if (!box) {
			throw new Error(`Missing ${entity} annotation`);
		}
		return {
			videoTimestampInMs: box.videoTimestampInMs,
			boundingBox: box.boundingBox,
		};
	}

	function buildAnnotation(): StructuredAnnotation {
		if (selectedType === "no-violation" || selectedType === null) {
			return { violation: { type: "no-violation" } };
		}

		switch (selectedType) {
			case "failure-to-yield":
				return {
					violation: {
						type: selectedType,
						vehicleAnnotation: annotationDataFor("vehicle"),
						pedestrianAnnotation: annotationDataFor("pedestrian"),
					},
				};
			case "red-light-violation":
				return {
					violation: {
						type: selectedType,
						vehicleAnnotation: annotationDataFor("vehicle"),
						redLightAnnotation: annotationDataFor("redLight"),
					},
				};
			case "speeding-violation":
				return {
					violation: {
						type: selectedType,
						vehicleAnnotation: annotationDataFor("vehicle"),
						speedLimit: speedLimitValue,
						actualSpeed: actualSpeedValue,
					},
				};
			case "distracted-driving-violation":
			case "stop-sign-violation":
			case "seatbelt-violation":
				return {
					violation: {
						type: selectedType,
						vehicleAnnotation: annotationDataFor("vehicle"),
					},
				};
		}
	}

	async function submitAnnotation() {
		if (!canSubmit || currentEvent === null) return;
		await annotateMutation.mutateAsync({
			trialId: triallSlug,
			eventId: currentEvent.id,
			annotation: buildAnnotation(),
		});
	}

	function togglePlayback() {
		const video = videoRef.current;
		if (!video) return;
		if (video.paused) {
			void video.play();
		} else {
			video.pause();
		}
	}

	function seekTo(seconds: number) {
		const video = videoRef.current;
		if (!video) return;
		video.currentTime = seconds;
		setCurrentTimeMs(seconds * 1000);
	}

	function syncVideoTiming(video: HTMLVideoElement) {
		setCurrentTimeMs(video.currentTime * 1000);

		const durationInSeconds =
			Number.isFinite(video.duration) && video.duration > 0
				? video.duration
				: video.seekable.length > 0
					? video.seekable.end(video.seekable.length - 1)
					: 0;

		setDurationMs(durationInSeconds * 1000);
	}

	if (eventsQuery.isPending) {
		return (
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div className="aspect-video animate-pulse rounded-xl bg-muted/50" />
				<div className="h-96 animate-pulse rounded-xl border border-border/60 bg-muted/30" />
			</div>
		);
	}

	if (eventsQuery.isError) {
		return (
			<div className="rounded-xl border border-dashed border-border px-4 py-12 text-center">
				<p className="font-medium text-(--sea-ink)">Could not load events</p>
				<p className="mt-2 text-sm text-muted-foreground">
					The event queue may be unavailable. Try refreshing the page.
				</p>
			</div>
		);
	}

	if (currentEvent === null) {
		return (
			<div className="rounded-xl border border-dashed border-border px-4 py-12 text-center">
				<p className="font-medium text-(--sea-ink)">All events are processed</p>
				<p className="mt-2 text-sm text-muted-foreground">
					There are no unprocessed events left for this trial.
				</p>
				<Button asChild variant="outline" className="mt-4">
					<Link to="/c/$portalSlug/trials" params={{ portalSlug }} search={{}}>
						Back to trials
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0 flex-1 space-y-2">
					<div>
						<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Annotation queue
						</p>
						<h1 className="text-2xl font-semibold tracking-tight text-(--sea-ink)">
							Review event
						</h1>
					</div>
					<div className="flex-1 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 shadow-sm">
						<div className="flex flex-wrap items-baseline justify-between gap-2">
							<p className="text-sm font-medium text-(--sea-ink)">
								<span className="text-2xl font-bold tabular-nums text-primary">
									{totalUnprocessed.toLocaleString()}
								</span>{" "}
								<span className="text-muted-foreground">
									unprocessed
									{totalUnprocessed === 1 ? " event" : " events"} left in this
									trial
								</span>
							</p>
							{queueBaseline > 0 && completedInSession > 0 ? (
								<span className="text-xs font-medium tabular-nums text-muted-foreground">
									{completedInSession.toLocaleString()} of{" "}
									{queueBaseline.toLocaleString()} done this session
								</span>
							) : null}
						</div>
						<div
							className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
							role="progressbar"
							aria-valuenow={completedInSession}
							aria-valuemin={0}
							aria-valuemax={queueBaseline}
							aria-label="Events completed this session"
						>
							<div
								className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
								style={{ width: `${queueProgressPercent}%` }}
							/>
						</div>
						<p className="mt-2 text-xs text-muted-foreground">
							Tip: use hotkeys for faster review. Press{" "}
							<HotkeyBadge>0-6</HotkeyBadge> for outcomes,{" "}
							<HotkeyBadge>V</HotkeyBadge>, <HotkeyBadge>P</HotkeyBadge>, or{" "}
							<HotkeyBadge>L</HotkeyBadge> for boxes,{" "}
							<HotkeyBadge>Space</HotkeyBadge> to play or pause, and{" "}
							<HotkeyBadge>Enter</HotkeyBadge> to finish.
						</p>
					</div>
				</div>
				<Button asChild variant="outline" size="sm">
					<Link to="/c/$portalSlug/trials" params={{ portalSlug }} search={{}}>
						All trials
					</Link>
				</Button>
			</header>

			<Card className="border-border/80">
				<CardHeader className="space-y-1 px-4 pt-3 pb-2">
					<CardTitle>1. Choose outcome</CardTitle>
					<CardDescription className="text-balance">
						Select the violation type first, then draw only the boxes required
						for that outcome.
					</CardDescription>
				</CardHeader>
				<CardContent className="px-4 pb-3 pt-0">
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
						{VIOLATION_OPTIONS.map((option, index) => (
							<button
								key={option.type}
								type="button"
								className="relative min-h-16 rounded-lg border border-border/80 p-2.5 pr-8 text-left transition hover:bg-muted/50 data-[selected=true]:border-primary data-[selected=true]:bg-primary/10"
								data-selected={selectedType === option.type}
								style={
									selectedType === option.type
										? {
												borderColor: option.color,
												backgroundColor: `${option.color}1A`,
											}
										: undefined
								}
								onClick={() => selectViolationType(option.type)}
							>
								<span className="absolute top-2 right-2">
									<HotkeyBadge>{OUTCOME_HOTKEYS[index]}</HotkeyBadge>
								</span>
								<span className="flex h-full flex-col items-start gap-1.5">
									<OutcomeIcon type={option.type} color={option.color} />
									<span className="block min-w-0 text-sm font-semibold leading-tight text-(--sea-ink)">
										{option.label}
									</span>
								</span>
							</button>
						))}
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
				<section className="flex min-w-0 flex-col gap-3">
					<div className="relative aspect-video overflow-hidden rounded-xl border border-border/80 bg-black">
						<video
							ref={videoRef}
							src={MOCK_VIDEO_SRC}
							muted
							className="size-full object-contain"
							onLoadedMetadata={(event) => syncVideoTiming(event.currentTarget)}
							onDurationChange={(event) => syncVideoTiming(event.currentTarget)}
							onCanPlay={(event) => syncVideoTiming(event.currentTarget)}
							onTimeUpdate={(event) => syncVideoTiming(event.currentTarget)}
							onPlay={() => setIsPlaying(true)}
							onPause={() => setIsPlaying(false)}
						/>
						<AnnotationCanvas
							activeEntity={activeEntity}
							boxes={boxes}
							currentVideoTimestampInMs={currentTimeMs}
							onDrawStart={beginDrawing}
							onCreateBox={addBox}
						/>
					</div>

					<Card className="border-border/80">
						<CardContent className="flex flex-col gap-2 p-3">
							<div className="flex flex-wrap items-center gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={togglePlayback}
								>
									{isPlaying ? "Pause" : "Play"}{" "}
									<HotkeyBadge>Space</HotkeyBadge>
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => seekTo(0)}
									disabled={durationMs === 0}
								>
									Restart <HotkeyBadge>R</HotkeyBadge>
								</Button>
								<span className="ml-auto font-mono text-sm text-muted-foreground">
									{formatTime(currentTimeMs)} / {formatTime(durationMs)}
								</span>
							</div>
							<Input
								type="range"
								min={0}
								max={Math.max(0, durationMs / 1000)}
								step={0.01}
								value={currentTimeMs / 1000}
								onChange={(event) => seekTo(Number(event.target.value))}
								disabled={durationMs === 0}
								aria-label="Video timeline"
							/>
						</CardContent>
					</Card>
				</section>

				<aside className="flex h-full min-h-0 flex-col gap-4">
					<Card className="flex min-h-0 flex-1 flex-col border-border/80">
						<CardHeader>
							<CardTitle>2. Draw required boxes</CardTitle>
							<CardDescription>
								Click an entity, then drag on the video. Drawing pauses
								playback.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex min-h-0 flex-1 flex-col gap-4">
							{selectedType === null ? (
								<p className="text-sm text-muted-foreground">
									Choose an outcome to begin.
								</p>
							) : requiredEntities.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No boxes are needed for this outcome.
								</p>
							) : (
								<div className="flex flex-wrap gap-2">
									{requiredEntities.map((entity) => {
										const hasBox = boxes.some((box) => box.entity === entity);
										return (
											<Button
												key={entity}
												type="button"
												variant={
													activeEntity === entity ? "default" : "outline"
												}
												size="sm"
												onClick={() => setActiveEntity(entity)}
											>
												{ENTITY_LABELS[entity]}
												{hasBox ? " ✓" : ""}
												<HotkeyBadge>{ENTITY_HOTKEYS[entity]}</HotkeyBadge>
											</Button>
										);
									})}
								</div>
							)}

							{needsSpeed ? (
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="speed-limit">Speed limit</Label>
										<Input
											id="speed-limit"
											type="number"
											min={1}
											value={speedLimit}
											onChange={(event) => setSpeedLimit(event.target.value)}
											placeholder="35"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="actual-speed">Actual speed</Label>
										<Input
											id="actual-speed"
											type="number"
											min={1}
											value={actualSpeed}
											onChange={(event) => setActualSpeed(event.target.value)}
											placeholder="52"
										/>
									</div>
								</div>
							) : null}

							{boxes.length > 0 ? (
								<ul className="min-h-0 space-y-2 overflow-auto">
									{boxes.map((box) => (
										<li
											key={box.id}
											className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
										>
											<span>
												{ENTITY_LABELS[box.entity]} at{" "}
												{formatTime(box.videoTimestampInMs)}
											</span>
											<Button
												type="button"
												variant="ghost"
												size="xs"
												onClick={() => removeBox(box.id)}
											>
												Remove
											</Button>
										</li>
									))}
								</ul>
							) : null}
						</CardContent>
					</Card>

					<Card className="shrink-0 border-border/80">
						<CardHeader>
							<CardTitle>3. Finish event</CardTitle>
							<CardDescription>
								Done becomes available when the selected outcome is complete.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{missingEntities.length > 0 ? (
								<p className="text-sm text-muted-foreground">
									Missing:{" "}
									{missingEntities
										.map((entity) => ENTITY_LABELS[entity])
										.join(", ")}
								</p>
							) : null}
							{needsSpeed && !speedReady ? (
								<p className="text-sm text-muted-foreground">
									Add speed limit and actual speed.
								</p>
							) : null}
							{annotateMutation.isError ? (
								<p className="text-sm text-destructive">
									Could not save this annotation. Try again.
								</p>
							) : null}
							<Button
								type="button"
								className="w-full"
								disabled={!canSubmit}
								onClick={() => void submitAnnotation()}
							>
								{annotateMutation.isPending ? "Saving..." : "Done"}{" "}
								<HotkeyBadge>Enter</HotkeyBadge>
							</Button>
						</CardContent>
					</Card>
				</aside>
			</div>
		</div>
	);
}
