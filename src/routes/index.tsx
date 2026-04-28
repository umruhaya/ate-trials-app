import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "~/auth";
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
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { ROUTES } from "~/lib/constants";
import { currentUserQueryOptions } from "~/lib/session";

export const Route = createFileRoute("/")({
	component: Home,
	validateSearch: (search: Record<string, unknown>) =>
		z
			.object({
				redirect: z.string().optional(),
			})
			.parse(search),
	beforeLoad: async ({ context, search }) => {
		const user = await context.queryClient.ensureQueryData(
			currentUserQueryOptions(),
		);
		if (!user) return;

		const next = search.redirect ?? ROUTES.DEFAULT(user.role);
		throw redirect({ to: next });
	},
});

type LoginRole = "admin" | "data-annotator";

const loginFormSchema = z.object({
	username: z.string().min(6, "Username must be at least 6 characters long"),
	role: z.enum(["admin", "data-annotator"]),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

const defaultLoginFormValues: LoginFormValues = {
	username: "",
	role: "admin",
};

function Home() {
	const auth = useAuth();
	const navigate = useNavigate({ from: "/" });
	const { redirect: redirectAfterLogin } = Route.useSearch();

	const loginForm = useForm({
		defaultValues: defaultLoginFormValues,
		onSubmit: async ({ value }) => {
			await auth.login(value.username, value.role);
			const next = redirectAfterLogin ?? ROUTES.DEFAULT(value.role);
			await navigate({ to: next });
		},
	});

	return (
		<div className="page-wrap flex min-h-screen flex-col items-center justify-center py-12">
			<Card className="island-shell w-full max-w-md rise-in">
				<CardHeader className="text-center">
					<p className="island-kicker mb-1">Trials app</p>
					<CardTitle className="display-title text-2xl">Sign in</CardTitle>
					<CardDescription>
						Choose how you&apos;re signing in, enter a username, then continue.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="space-y-3">
						<loginForm.Field
							name="role"
							children={(field) => (
								<>
									<Label className="text-(--sea-ink)">Role</Label>
									<RadioGroup
										value={field.state.value}
										onValueChange={(value) =>
											field.handleChange(value as LoginRole)
										}
										className="gap-3"
									>
										<label
											htmlFor="role-admin"
											className="feature-card flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3"
										>
											<RadioGroupItem value="admin" id="role-admin" />
											<div>
												<span className="font-medium">Admin</span>
												<p className="text-xs text-muted-foreground">
													Full access — goes to trials after login
												</p>
											</div>
										</label>
										<label
											htmlFor="role-contributor"
											className="feature-card flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3"
										>
											<RadioGroupItem
												value="data-annotator"
												id="role-contributor"
											/>
											<div>
												<span className="font-medium">Contributor</span>
												<p className="text-xs text-muted-foreground">
													Data annotator — goes to events after login
												</p>
											</div>
										</label>
									</RadioGroup>
									{field.state.meta.errors.map((error) => (
										<div
											key={`role-${error?.message ?? "error"}`}
											className="text-sm text-destructive"
											role="alert"
										>
											{error?.message}
										</div>
									))}
								</>
							)}
						/>
					</div>
					<div className="space-y-2">
						<loginForm.Field
							name="username"
							children={(field) => (
								<>
									<Label htmlFor="username" className="text-(--sea-ink)">
										Username
									</Label>
									<Input
										id="username"
										name="username"
										autoComplete="username"
										placeholder="your.name"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && !auth.loginPending) {
												e.preventDefault();
												loginForm.handleSubmit();
											}
										}}
									/>
									{field.state.meta.errors.map((error) => (
										<div
											key={`username-${error?.message ?? "error"}`}
											className="text-sm text-destructive"
											role="alert"
										>
											{error?.message}
										</div>
									))}
								</>
							)}
						/>
					</div>
					{auth.loginError ? (
						<p className="text-sm text-destructive" role="alert">
							{auth.loginError instanceof Error
								? auth.loginError.message
								: "Could not sign in. Try again."}
						</p>
					) : null}
				</CardContent>
				<CardFooter className="flex flex-col gap-3 border-t border-border/60 pt-6">
					<Button
						type="button"
						className="w-full cursor-pointer"
						disabled={auth.loginPending}
						onClick={() => loginForm.handleSubmit()}
					>
						{auth.loginPending ? "Signing in…" : "Sign in"}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
