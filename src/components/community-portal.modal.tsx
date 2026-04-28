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
import { client, orpc } from "~/orpc/client";
import { communityPortalSchema } from "~/schemas/community-portal";

const createCommunityPortalSchema = communityPortalSchema.pick({
	name: true,
	slug: true,
	description: true,
});
type CreateCommunityPortalValues = z.infer<typeof createCommunityPortalSchema>;

const editCommunityPortalSchema = communityPortalSchema.pick({
	name: true,
	description: true,
	isActive: true,
});
type EditCommunityPortalValues = z.infer<typeof editCommunityPortalSchema>;

export type CommunityPortalForModal = Pick<
	z.infer<typeof communityPortalSchema>,
	"id" | "name" | "slug" | "description" | "isActive"
>;

const createDefaultValues: CreateCommunityPortalValues = {
	name: "",
	slug: "",
	description: "",
};

type CommunityPortalModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** When set, the modal edits this portal (name, description, active). Slug is shown read-only. */
	editingPortal?: CommunityPortalForModal | null;
};

export function CommunityPortalModal({
	open,
	onOpenChange,
	editingPortal = null,
}: CommunityPortalModalProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
			}}
		>
			<DialogContent className="max-h-[90vh] overflow-y-auto border-border/80 sm:max-w-lg">
				{open ? (
					editingPortal ? (
						<EditCommunityPortalForm
							key={editingPortal.id}
							portal={editingPortal}
							onClose={() => onOpenChange(false)}
						/>
					) : (
						<CreateCommunityPortalForm
							key="create"
							onClose={() => onOpenChange(false)}
						/>
					)
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function CreateCommunityPortalForm({ onClose }: { onClose: () => void }) {
	const queryClient = useQueryClient();

	const createMutation = useMutation(
		orpc.communityPortal.create.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.communityPortal.list.key({ type: "query" }),
				});
				onClose();
			},
		}),
	);

	const form = useForm({
		defaultValues: createDefaultValues,
		validators: { onSubmit: createCommunityPortalSchema },
		onSubmit: async ({ value }) => {
			await createMutation.mutateAsync({
				name: value.name,
				slug: value.slug,
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
					New community portal
				</DialogTitle>
				<DialogDescription>
					Add a portal visitors can open. Slug appears in the URL and must stay
					unique.
				</DialogDescription>
			</DialogHeader>

			<div className="grid gap-4 py-4">
				<form.Field
					name="name"
					children={(field) => (
						<div className="space-y-2">
							<Label htmlFor={`${field.name}-modal`}>Name</Label>
							<Input
								id={`${field.name}-modal`}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="e.g. North region"
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
					name="slug"
					asyncDebounceMs={500}
					validators={{
						onChangeAsync: async ({ value, signal }) => {
							const slug = value.trim();
							if (!slug) {
								return;
							}
							const shape =
								createCommunityPortalSchema.shape.slug.safeParse(slug);
							if (!shape.success) {
								return;
							}
							if (signal.aborted) {
								return;
							}
							const existingPortal = await client.communityPortal
								.getById({
									id: slug,
								})
								.catch(() => null);
							if (signal.aborted) {
								return;
							}
							if (existingPortal) {
								return "This slug is already in use.";
							}
						},
					}}
					children={(field) => (
						<div className="space-y-2">
							<Label htmlFor={`${field.name}-modal`}>Slug</Label>
							<Input
								id={`${field.name}-modal`}
								value={field.state.value}
								onChange={(e) =>
									field.handleChange(
										e.target.value.toLowerCase().replace(/\s+/g, "-"),
									)
								}
								placeholder="e.g. north-region"
								autoComplete="off"
							/>
							{field.state.meta.errors.map((err) => {
								const slugErrText =
									typeof err === "string" ? err : (err?.message ?? "");
								return (
									<p
										key={`slug-error-${slugErrText}`}
										className="text-sm text-destructive"
										role="alert"
									>
										{slugErrText}
									</p>
								);
							})}
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
								placeholder="Short summary for members"
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
						: "Could not create portal."}
				</p>
			) : null}

			<DialogFooter className="gap-2 sm:gap-0">
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
					Create portal
				</Button>
			</DialogFooter>
		</form>
	);
}

function EditCommunityPortalForm({
	portal,
	onClose,
}: {
	portal: CommunityPortalForModal;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();

	const updateMutation = useMutation(
		orpc.communityPortal.update.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.communityPortal.list.key({ type: "query" }),
				});
				onClose();
			},
		}),
	);

	const form = useForm({
		defaultValues: {
			name: portal.name,
			description: portal.description,
			isActive: portal.isActive,
		} satisfies EditCommunityPortalValues,
		validators: { onSubmit: editCommunityPortalSchema },
		onSubmit: async ({ value }) => {
			await updateMutation.mutateAsync({
				id: portal.id,
				name: value.name,
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
					Edit community portal
				</DialogTitle>
				<DialogDescription>
					Update how this portal appears and whether it stays visible. The URL
					slug cannot be changed here.
				</DialogDescription>
			</DialogHeader>

			<div className="grid gap-4 py-4">
				<div className="space-y-2">
					<Label>Slug</Label>
					<p className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 font-mono text-sm text-muted-foreground">
						/{portal.slug}
					</p>
				</div>
				<form.Field
					name="name"
					children={(field) => (
						<div className="space-y-2">
							<Label htmlFor={`${field.name}-edit-modal`}>Name</Label>
							<Input
								id={`${field.name}-edit-modal`}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="e.g. North region"
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
								placeholder="Short summary for members"
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
							<Label htmlFor="portal-status-edit">Status</Label>
							<Select
								value={field.state.value ? "active" : "inactive"}
								onValueChange={(v) => field.handleChange(v === "active")}
							>
								<SelectTrigger id="portal-status-edit">
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
						: "Could not update portal."}
				</p>
			) : null}

			<DialogFooter className="gap-2 sm:gap-0">
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
			</DialogFooter>
		</form>
	);
}
