import type { PointerEvent } from "react";
import { useState } from "react";
import { cn } from "~/lib/utils";

export type AnnotationEntity = "vehicle" | "pedestrian" | "redLight";

export type AnnotationBoundingBox = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type AnnotationBox = {
	id: string;
	entity: AnnotationEntity;
	videoTimestampInMs: number;
	boundingBox: AnnotationBoundingBox;
};

type Point = {
	x: number;
	y: number;
};

type DraftBox = {
	entity: AnnotationEntity;
	videoTimestampInMs: number;
	start: Point;
	current: Point;
};

const ENTITY_LABELS: Record<AnnotationEntity, string> = {
	vehicle: "Vehicle",
	pedestrian: "Pedestrian",
	redLight: "Red light",
};

const ENTITY_COLORS: Record<AnnotationEntity, string> = {
	vehicle: "#2563eb",
	pedestrian: "#16a34a",
	redLight: "#ef4444",
};

const MIN_BOX_SIZE = 0.01;
const BOX_VISIBILITY_WINDOW_MS = 1000;

function clamp01(value: number) {
	return Math.min(1, Math.max(0, value));
}

function boxFromPoints(start: Point, current: Point): AnnotationBoundingBox {
	const x1 = clamp01(Math.min(start.x, current.x));
	const y1 = clamp01(Math.min(start.y, current.y));
	const x2 = clamp01(Math.max(start.x, current.x));
	const y2 = clamp01(Math.max(start.y, current.y));

	return {
		x: x1,
		y: y1,
		width: x2 - x1,
		height: y2 - y1,
	};
}

function getSvgPoint(event: PointerEvent<SVGSVGElement>): Point {
	const rect = event.currentTarget.getBoundingClientRect();
	return {
		x: clamp01((event.clientX - rect.left) / rect.width),
		y: clamp01((event.clientY - rect.top) / rect.height),
	};
}

function EntityIcon({ entity }: { entity: AnnotationEntity }) {
	switch (entity) {
		case "vehicle":
			return (
				<svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
					<path
						d="M5 13h14l-1.8-5.2A2.8 2.8 0 0 0 14.6 6H9.4a2.8 2.8 0 0 0-2.6 1.8L5 13Z"
						fill="none"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="2"
					/>
					<path
						d="M4 13h16v5H4z"
						fill="none"
						stroke="currentColor"
						strokeLinejoin="round"
						strokeWidth="2"
					/>
					<circle cx="8" cy="18" r="1.7" fill="currentColor" />
					<circle cx="16" cy="18" r="1.7" fill="currentColor" />
				</svg>
			);
		case "pedestrian":
			return (
				<svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
					<circle cx="12" cy="5" r="2.5" fill="currentColor" />
					<path d="M10 9h4l1 5h-2v6h-2v-6H9l1-5Z" fill="currentColor" />
					<path
						d="M9 11 5 14m10-3 4 3"
						fill="none"
						stroke="currentColor"
						strokeLinecap="round"
						strokeWidth="2"
					/>
				</svg>
			);
		case "redLight":
			return (
				<svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
					<rect
						x="8"
						y="3"
						width="8"
						height="18"
						rx="3"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					/>
					<circle cx="12" cy="8" r="1.8" fill="currentColor" />
					<circle cx="12" cy="13" r="1.8" fill="currentColor" opacity="0.55" />
					<circle cx="12" cy="18" r="1.8" fill="currentColor" opacity="0.55" />
				</svg>
			);
	}
}

function SvgBox({
	box,
	opacity = 1,
}: {
	box: AnnotationBox;
	opacity?: number;
}) {
	const color = ENTITY_COLORS[box.entity];
	const { x, y, width, height } = box.boundingBox;
	const labelY = Math.max(0, y - 0.055);

	return (
		<g opacity={opacity}>
			<rect
				x={`${x * 100}%`}
				y={`${y * 100}%`}
				width={`${width * 100}%`}
				height={`${height * 100}%`}
				fill="transparent"
				stroke={color}
				strokeWidth="3"
				vectorEffect="non-scaling-stroke"
			/>
			<foreignObject
				x={`${x * 100}%`}
				y={`${labelY * 100}%`}
				width="132"
				height="34"
			>
				<div
					className="flex h-7 w-fit max-w-32 items-center gap-1.5 rounded-full border border-white/70 px-2 text-xs font-semibold text-white shadow-sm backdrop-blur-sm"
					style={{ backgroundColor: color }}
				>
					<EntityIcon entity={box.entity} />
					<span className="truncate">{ENTITY_LABELS[box.entity]}</span>
				</div>
			</foreignObject>
		</g>
	);
}

export function AnnotationCanvas({
	activeEntity,
	boxes,
	currentVideoTimestampInMs,
	onDrawStart,
	onCreateBox,
	className,
}: {
	activeEntity: AnnotationEntity | null;
	boxes: AnnotationBox[];
	currentVideoTimestampInMs: number;
	onDrawStart: () => number;
	onCreateBox: (box: Omit<AnnotationBox, "id">) => void;
	className?: string;
}) {
	const [draft, setDraft] = useState<DraftBox | null>(null);
	const visibleBoxes = boxes.filter(
		(box) =>
			Math.abs(currentVideoTimestampInMs - box.videoTimestampInMs) <=
			BOX_VISIBILITY_WINDOW_MS,
	);

	function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
		if (activeEntity === null || event.button !== 0) return;

		const point = getSvgPoint(event);
		event.currentTarget.setPointerCapture(event.pointerId);
		setDraft({
			entity: activeEntity,
			videoTimestampInMs: onDrawStart(),
			start: point,
			current: point,
		});
	}

	function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
		if (draft === null) return;
		const point = getSvgPoint(event);
		setDraft((current) =>
			current === null ? null : { ...current, current: point },
		);
	}

	function finishDraft() {
		if (draft === null) return;

		const boundingBox = boxFromPoints(draft.start, draft.current);
		if (
			boundingBox.width >= MIN_BOX_SIZE &&
			boundingBox.height >= MIN_BOX_SIZE
		) {
			onCreateBox({
				entity: draft.entity,
				videoTimestampInMs: draft.videoTimestampInMs,
				boundingBox,
			});
		}
		setDraft(null);
	}

	const draftBox =
		draft === null
			? null
			: {
					id: "draft",
					entity: draft.entity,
					videoTimestampInMs: draft.videoTimestampInMs,
					boundingBox: boxFromPoints(draft.start, draft.current),
				};

	return (
		<svg
			className={cn(
				"absolute inset-0 size-full touch-none select-none",
				activeEntity === null ? "cursor-default" : "cursor-crosshair",
				className,
			)}
			role="img"
			aria-label="Video annotation canvas"
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={finishDraft}
			onPointerCancel={finishDraft}
		>
			<title>Annotation canvas</title>
			{visibleBoxes.map((box) => (
				<SvgBox key={box.id} box={box} />
			))}
			{draftBox === null ? null : <SvgBox box={draftBox} opacity={0.75} />}
		</svg>
	);
}
