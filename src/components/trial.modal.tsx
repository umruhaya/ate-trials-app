import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, format, startOfDay } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { orpc } from "~/orpc/client";
import { trialSchema } from "~/schemas/trial";

const createTrialFormSchema = z
	.object({
		title: trialSchema.shape.title,
		description: trialSchema.shape.description,
		dateRange: z
			.object({
				from: z.date().optional(),
				to: z.date().optional(),
			})
			.optional(),
		locationIds: z.array(z.string()),
	})
	.superRefine((data, ctx) => {
		if (
			data.dateRange?.from === undefined ||
			data.dateRange?.to === undefined
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Select a timeframe (start and end date).",
				path: ["dateRange"],
			});
		} else if (data.dateRange.to < data.dateRange.from) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "End date must be on or after the start date.",
				path: ["dateRange"],
			});
		}
		if (data.locationIds.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Select at least one location.",
				path: ["locationIds"],
			});
		}
	});
type CreateTrialValues = z.infer<typeof createTrialFormSchema>;

const editTrialSchema = trialSchema.pick({
	title: true,
	description: true,
	isActive: true,
});
type EditTrialValues = z.infer<typeof editTrialSchema>;

export type TrialForModal = Pick<
	z.infer<typeof trialSchema>,
	"id" | "title" | "description" | "isActive"
>;

const createDefaultValues: CreateTrialValues = {
	title: "",
	description: "",
	dateRange: undefined,
	locationIds: [],
};

function timeframeButtonLabel(dr: DateRange | undefined): string {
	if (!dr?.from || !dr?.to) {
		return "Pick a period";
	}
	return `${format(dr.from, "PP")} — ${format(dr.to, "PP")}`;
}

type TrialModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portalSlug: string;
	editingTrial?: TrialForModal | null;
};

export function TrialModal({
	open,
	onOpenChange,
	portalSlug,
	editingTrial = null,
}: TrialModalProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
			}}
		>
			<DialogContent className="max-h-[90vh] overflow-y-auto border-border/80 sm:max-w-2xl">
				{open ? (
					editingTrial ? (
						<EditTrialForm
							key={editingTrial.id}
							trial={editingTrial}
							onClose={() => onOpenChange(false)}
						/>
					) : (
						<CreateTrialForm
							key="create"
							portalSlug={portalSlug}
							onClose={() => onOpenChange(false)}
						/>
					)
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function CreateTrialForm({
	portalSlug,
	onClose,
}: {
	portalSlug: string;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();

	const createMutation = useMutation(
		orpc.trials.create.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.trials.list.key({ type: "query" }),
				});
				onClose();
			},
		}),
	);

	const form = useForm({
		defaultValues: createDefaultValues,
		validators: { onSubmit: createTrialFormSchema },
		onSubmit: async ({ value }) => {
			const dr = value.dateRange;
			if (
				value.locationIds.length === 0 ||
				dr?.from === undefined ||
				dr?.to === undefined
			) {
				return;
			}
			await createMutation.mutateAsync({
				portalSlug,
				title: value.title,
				description: value.description,
				startDate: startOfDay(dr.from),
				endDate: endOfDay(dr.to),
				locationIds: value.locationIds,
			});
			form.reset();
		},
	});

	const dateRange = useStore(form.store, (s) => s.values.dateRange);
	const timeframeComplete =
		dateRange?.from !== undefined &&
		dateRange?.to !== undefined &&
		dateRange.to >= dateRange.from;

	const statsInput =
		timeframeComplete &&
		dateRange?.from !== undefined &&
		dateRange.to !== undefined
			? {
					startDate: startOfDay(dateRange.from),
					endDate: endOfDay(dateRange.to),
				}
			: { startDate: new Date(0), endDate: new Date(0) };

	const statsQuery = useQuery({
		...orpc.locations.stats.queryOptions({
			input: statsInput,
		}),
		enabled: timeframeComplete,
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<DialogHeader>
				<DialogTitle className="display-title text-(--sea-ink)">
					New trial
				</DialogTitle>
				<DialogDescription>
					Add a trial for this community portal.
				</DialogDescription>
			</DialogHeader>

			<div className="grid gap-4 py-4">
				<form.Field
					name="title"
					children={(field) => (
						<div className="space-y-2">
							<Label htmlFor={`${field.name}-modal`}>Title</Label>
							<Input
								id={`${field.name}-modal`}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="e.g. Q2 observation study"
								autoComplete="off"
							/>
							{field.state.meta.errors.map((err) => (
								<p
									key={err?.message}
									className="text-sm text-destructive"
									role="alert"
								>
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>
				<form.Field
					name="description"
					children={(field) => (
						<div className="space-y-2">
							<Label htmlFor={`${field.name}-modal`}>Description</Label>
							<Textarea
								id={`${field.name}-modal`}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Summary for participants"
								rows={4}
								className="resize-y"
							/>
							{field.state.meta.errors.map((err) => (
								<p
									key={err?.message}
									className="text-sm text-destructive"
									role="alert"
								>
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>
				<form.Field
					name="dateRange"
					children={(field) => (
						<div className="space-y-2">
							<Label>Trial timeframe</Label>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										type="button"
										className="w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
										data-empty={
											!field.state.value?.from || !field.state.value?.to
										}
										variant="outline"
										id="trial-timeframe-trigger"
										aria-invalid={field.state.meta.errors.length > 0}
									>
										<CalendarIcon
											className="mr-2 size-4 shrink-0"
											aria-hidden
										/>
										<span>
											{timeframeButtonLabel(field.state.value as DateRange)}
										</span>
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto max-w-none p-0">
									<Calendar
										mode="range"
										selected={field.state.value as DateRange | undefined}
										numberOfMonths={2}
										onSelect={(range) => {
											field.handleChange(
												range
													? {
															from: range.from,
															to: range.to,
														}
													: undefined,
											);
											form.setFieldValue("locationIds", []);
										}}
									/>
								</PopoverContent>
							</Popover>
							{field.state.meta.errors.map((err) => (
								<p
									key={err?.message}
									className="text-sm text-destructive"
									role="alert"
								>
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>
				<form.Field
					name="locationIds"
					children={(field) => (
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label>Locations included</Label>
								{statsQuery.isFetching ? (
									<span className="text-muted-foreground text-xs">
										Refreshing counts…
									</span>
								) : null}
							</div>
							{timeframeComplete ? (
								statsQuery.data ? (
									<ul className="max-h-52 space-y-2 overflow-auto rounded-lg border bg-muted/35 p-2 text-sm shadow-inner dark:bg-muted/20">
										{statsQuery.data.locations.map((loc) => {
											const checked = field.state.value.includes(loc.id);
											return (
												<li key={loc.id}>
													<label
														htmlFor={`loc-${loc.id}`}
														className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-accent/60"
													>
														<input
															type="checkbox"
															id={`loc-${loc.id}`}
															className="mt-1 size-4 shrink-0 accent-primary"
															checked={checked}
															onChange={(e) => {
																const ids = field.state.value;
																if (e.target.checked) {
																	field.handleChange([...ids, loc.id]);
																} else {
																	field.handleChange(
																		ids.filter((id) => id !== loc.id),
																	);
																}
															}}
														/>
														<span className="min-w-0 flex-1">
															<span className="font-medium">
																{loc.locationName}
															</span>
															<span className="text-muted-foreground mx-1.5">
																—
															</span>
															<span className="text-muted-foreground text-xs">
																{loc.city}, {loc.state}
															</span>
															<span className="text-muted-foreground mt-1 block text-xs tabular-nums">
																{loc.eventCount} event
																{loc.eventCount === 1 ? "" : "s"}
															</span>
														</span>
													</label>
												</li>
											);
										})}
									</ul>
								) : statsQuery.isLoading ? (
									<p className="text-muted-foreground text-sm">
										Loading locations…
									</p>
								) : null
							) : (
								<p className="text-muted-foreground text-sm">
									Choose a start and end date to load deployment locations and
									event counts.
								</p>
							)}
							{field.state.meta.errors.map((err) => (
								<p
									key={err?.message}
									className="text-sm text-destructive"
									role="alert"
								>
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>
			</div>

			{createMutation.error ? (
				<p className="mb-4 text-sm text-destructive" role="alert">
					{createMutation.error instanceof Error
						? createMutation.error.message
						: "Could not create trial."}
				</p>
			) : null}

			<DialogFooter className="gap-2 sm:gap-0">
				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={onClose}
						disabled={createMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						className="gap-2"
						disabled={createMutation.isPending}
					>
						{createMutation.isPending ? (
							<Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
						) : null}
						Create trial
					</Button>
				</div>
			</DialogFooter>
		</form>
	);
}

function EditTrialForm({
	trial,
	onClose,
}: {
	trial: TrialForModal;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();

	const updateMutation = useMutation(
		orpc.trials.update.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.trials.list.key({ type: "query" }),
				});
				onClose();
			},
		}),
	);

	const form = useForm({
		defaultValues: {
			title: trial.title,
			description: trial.description,
			isActive: trial.isActive,
		} satisfies EditTrialValues,
		validators: { onSubmit: editTrialSchema },
		onSubmit: async ({ value }) => {
			await updateMutation.mutateAsync({
				id: trial.id,
				title: value.title,
				description: value.description,
				isActive: value.isActive,
			});
			form.reset();
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<DialogHeader>
				<DialogTitle className="display-title text-(--sea-ink)">
					Edit trial
				</DialogTitle>
				<DialogDescription>
					Update the trial title, description, and visibility.
				</DialogDescription>
			</DialogHeader>

			<div className="grid gap-4 py-4">
				<form.Field
					name="title"
					children={(field) => (
						<div className="space-y-2">
							<Label htmlFor={`${field.name}-edit-modal`}>Title</Label>
							<Input
								id={`${field.name}-edit-modal`}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="e.g. Q2 observation study"
								autoComplete="off"
							/>
							{field.state.meta.errors.map((err) => (
								<p
									key={err?.message}
									className="text-sm text-destructive"
									role="alert"
								>
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>
				<form.Field
					name="description"
					children={(field) => (
						<div className="space-y-2">
							<Label htmlFor={`${field.name}-edit-modal`}>Description</Label>
							<Textarea
								id={`${field.name}-edit-modal`}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Summary for participants"
								rows={4}
								className="resize-y"
							/>
							{field.state.meta.errors.map((err) => (
								<p
									key={err?.message}
									className="text-sm text-destructive"
									role="alert"
								>
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>
				<form.Field
					name="isActive"
					children={(field) => (
						<div className="space-y-2">
							<Label htmlFor="trial-status-edit">Status</Label>
							<Select
								value={field.state.value ? "active" : "inactive"}
								onValueChange={(v) => field.handleChange(v === "active")}
							>
								<SelectTrigger id="trial-status-edit">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
								</SelectContent>
							</Select>
							{field.state.meta.errors.map((err) => (
								<p
									key={err?.message}
									className="text-sm text-destructive"
									role="alert"
								>
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>
			</div>

			{updateMutation.error ? (
				<p className="mb-4 text-sm text-destructive" role="alert">
					{updateMutation.error instanceof Error
						? updateMutation.error.message
						: "Could not update trial."}
				</p>
			) : null}

			<DialogFooter className="gap-2 sm:gap-0">
				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={onClose}
						disabled={updateMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						className="gap-2"
						disabled={updateMutation.isPending}
					>
						{updateMutation.isPending ? (
							<Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
						) : null}
						Save changes
					</Button>
				</div>
			</DialogFooter>
		</form>
	);
}
