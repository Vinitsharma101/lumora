import { useCallback, useEffect, useState } from "react";
import { apiFetch, setAuthToken, clearAuthToken } from "@/lib/api-client";

interface User {
	id: string;
	name: string;
	email: string;
	email_verified: boolean;
	image: string | null;
}

interface SessionData {
	user: User | null;
	isPending: boolean;
}

export async function signUp({
	name,
	email,
	password,
}: {
	name: string;
	email: string;
	password: string;
}) {
	const response = await apiFetch("/api/auth/sign-up", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, email, password }),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.detail || "Sign up failed");
	}

	const data = await response.json();
	setAuthToken(data.token);
	return { data: data.user };
}

export async function signIn({
	email,
	password,
}: {
	email: string;
	password: string;
}) {
	const response = await apiFetch("/api/auth/sign-in", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.detail || "Sign in failed");
	}

	const data = await response.json();
	setAuthToken(data.token);
	return { data: data.user };
}

export async function signOut() {
	clearAuthToken();
}

export function useSession(): SessionData {
	const [user, setUser] = useState<User | null>(null);
	const [isPending, setIsPending] = useState(true);

	const fetchSession = useCallback(async () => {
		try {
			const response = await apiFetch("/api/auth/get-session");
			if (response.ok) {
				const userData = await response.json();
				setUser(userData);
			} else {
				setUser(null);
			}
		} catch {
			setUser(null);
		} finally {
			setIsPending(false);
		}
	}, []);

	useEffect(() => {
		fetchSession();
	}, [fetchSession]);

	return { user, isPending };
}
