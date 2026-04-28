import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { Button } from "~/components/ui/button";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { orpc } from "~/orpc/client";
import { trialSchema } from "~/schemas/trial";

const createTrialSchema = trialSchema.pick({
	title: true,
	description: true,
});
type CreateTrialValues = z.infer<typeof createTrialSchema>;

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
};

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
			<DialogContent className="max-h-[90vh] overflow-y-auto border-border/80 sm:max-w-lg">
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
		validators: { onSubmit: createTrialSchema },
		onSubmit: async ({ value }) => {
			await createMutation.mutateAsync({
				portalSlug,
				title: value.title,
				description: value.description,
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
