const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getAuthToken(): string | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem("opencut_token");
}

export function setAuthToken(token: string): void {
	localStorage.setItem("opencut_token", token);
}

export function clearAuthToken(): void {
	localStorage.removeItem("opencut_token");
}

/**
 * Fetch wrapper that prepends the API URL and attaches the JWT token.
 * Drop-in replacement for `fetch("/api/...")` calls.
 */
export async function apiFetch(
	path: string,
	init?: RequestInit,
): Promise<Response> {
	const token = getAuthToken();
	const headers = new Headers(init?.headers);

	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}

	return fetch(`${API_URL}${path}`, {
		...init,
		headers,
	});
}
