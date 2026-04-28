import { useNavigate } from "@tanstack/react-router";
import { DropdownMenu } from "radix-ui";
import { useAuth } from "~/auth";
import { cn } from "~/lib/utils";

function initialsFromUsername(username: string): string {
	const trimmed = username.trim();
	if (!trimmed) return "?";
	const parts = trimmed.split(/\s+/);
	if (parts.length >= 2) {
		const a = parts[0][0];
		const b = parts[parts.length - 1][0];
		return `${a}${b}`.toUpperCase();
	}
	return trimmed.slice(0, 2).toUpperCase();
}

export function UserAppHeader() {
	const navigate = useNavigate();
	const { user, isLoading, logout } = useAuth();

	if (isLoading || !user) {
		return null;
	}

	const initials = initialsFromUsername(user.username);

	async function handleSignOut() {
		await logout();
		await navigate({ to: "/" });
	}

	return (
		<header
			className={cn(
				"sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md",
				"supports-backdrop-filter:bg-background/75",
			)}
		>
			<div className="mx-auto flex h-14 max-w-[1400px] items-center justify-end px-4 sm:px-6">
				<DropdownMenu.Root modal={false}>
					<DropdownMenu.Trigger asChild>
						<button
							type="button"
							className={cn(
								"cursor-pointer",
								"flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
								"bg-primary text-primary-foreground shadow-sm outline-none",
								"ring-offset-background transition-[box-shadow,transform]",
								"hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								"data-[state=open]:ring-2 data-[state=open]:ring-ring data-[state=open]:ring-offset-2",
							)}
							aria-label="Account menu"
						>
							{initials}
						</button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Portal>
						<DropdownMenu.Content
							align="end"
							sideOffset={8}
							className={cn(
								"z-50 min-w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
								"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
								"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
								"data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
							)}
						>
							<div className="px-2 py-1.5">
								<p className="text-sm font-medium text-foreground">
									{user.username}
								</p>
								<p className="text-xs text-muted-foreground capitalize">
									{user.role.replaceAll("-", " ")}
								</p>
							</div>
							<DropdownMenu.Separator className="my-1 h-px bg-border" />
							<DropdownMenu.Item
								className={cn(
									"flex cursor-pointer items-center justify-center rounded-sm px-2 py-2 text-sm font-medium outline-none",
									"text-destructive focus:bg-destructive/10",
								)}
								onSelect={() => {
									void handleSignOut();
								}}
							>
								Sign out
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
			</div>
		</header>
	);
}
