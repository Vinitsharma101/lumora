import { useCallback, useEffect, useRef } from "react";
import { useMovieStore } from "@/stores/movie-store";

/**
 * Hook for managing agent session polling lifecycle.
 * Starts polling when a session is active, stops on unmount or completion.
 */
export function useAgentSession() {
	const sessionId = useMovieStore((state) => state.sessionId);
	const status = useMovieStore((state) => state.status);
	const isPolling = useMovieStore((state) => state.isPolling);
	const startPolling = useMovieStore((state) => state.startPolling);
	const stopPolling = useMovieStore((state) => state.stopPolling);
	const pollStatus = useMovieStore((state) => state.pollStatus);
	const hasStartedRef = useRef(false);

	useEffect(() => {
		if (sessionId && !isPolling && status === "processing" && !hasStartedRef.current) {
			hasStartedRef.current = true;
			startPolling();
		}
	}, [sessionId, isPolling, status, startPolling]);

	useEffect(() => {
		return () => {
			stopPolling();
			hasStartedRef.current = false;
		};
	}, [stopPolling]);

	const refresh = useCallback(() => {
		if (sessionId) {
			pollStatus();
		}
	}, [sessionId, pollStatus]);

	return { refresh };
}
