import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
} from "react";
import { currentUserQueryOptions } from "~/lib/session";
import type { AuthenticatedUser } from "~/orpc/base";
import { orpc } from "~/orpc/client";

export type LoginRole = AuthenticatedUser["role"];

type AuthState = {
	user: AuthenticatedUser | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	loginPending: boolean;
	loginError: unknown;
	login: (username: string, role: LoginRole) => Promise<void>;
	logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();

	const session = useQuery({
		...currentUserQueryOptions(),
	});

	const invalidateSession = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.auth.getCurrentUser.queryKey(),
		});
	}, [queryClient]);

	const loginMutation = useMutation(
		orpc.auth.login.mutationOptions({
			onSuccess: invalidateSession,
		}),
	);

	const logoutMutation = useMutation(
		orpc.auth.logout.mutationOptions({
			onSuccess: invalidateSession,
		}),
	);

	const login = useCallback(
		async (username: string, role: LoginRole) => {
			await loginMutation.mutateAsync({ username, role });
		},
		[loginMutation],
	);

	const logout = useCallback(async () => {
		await logoutMutation.mutateAsync(undefined);
	}, [logoutMutation]);

	const value = useMemo<AuthState>(
		() => ({
			user: session.data ?? null,
			isAuthenticated: !!session.data,
			isLoading: session.isPending,
			loginPending: loginMutation.isPending,
			loginError: loginMutation.error ?? null,
			login,
			logout,
		}),
		[
			session.data,
			session.isPending,
			loginMutation.isPending,
			loginMutation.error,
			login,
			logout,
		],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return ctx;
}
