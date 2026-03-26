import { useCallback, useEffect, useRef } from "react";
import { useMovieStore } from "@/stores/movie-store";
import type {
	ActProgress,
	MovieState,
} from "@/stores/movie-store";

const ACTIVE_STATUSES = new Set([
	"processing",
	"waiting_approval",
	"waiting_storyboard_approval",
	"paused_checkpoint",
]);

/**
 * Hook for managing agent session updates.
 * Tries SSE (Server-Sent Events) for real-time updates via Upstash Redis,
 * falls back to interval polling if SSE is unavailable.
 */
export function useAgentSession() {
	const sessionId = useMovieStore((state) => state.sessionId);
	const status = useMovieStore((state) => state.status);
	const isPolling = useMovieStore((state) => state.isPolling);
	const startPolling = useMovieStore((state) => state.startPolling);
	const stopPolling = useMovieStore((state) => state.stopPolling);
	const pollStatus = useMovieStore((state) => state.pollStatus);
	const hasStartedRef = useRef(false);
	const sseRef = useRef<EventSource | null>(null);
	const sseConnectedRef = useRef(false);

	// Try SSE connection for real-time updates
	useEffect(() => {
		if (!sessionId) return;
		if (!ACTIVE_STATUSES.has(status)) return;

		const sseUrl = `/api/agent/stream/${sessionId}`;

		try {
			const eventSource = new EventSource(sseUrl);
			sseRef.current = eventSource;

			eventSource.onopen = () => {
				sseConnectedRef.current = true;
				// Stop polling since we have SSE
				stopPolling();
			};

			eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					applyStatusUpdate(data);
				} catch {
					// Ignore parse errors
				}
			};

			eventSource.onerror = () => {
				sseConnectedRef.current = false;
				eventSource.close();
				sseRef.current = null;
				// Fall back to polling
				const currentStatus = useMovieStore.getState().status;
				if (ACTIVE_STATUSES.has(currentStatus)) {
					startPolling();
				}
			};
		} catch {
			// SSE construction failed, fall back to polling
			sseConnectedRef.current = false;
		}

		return () => {
			if (sseRef.current) {
				sseRef.current.close();
				sseRef.current = null;
				sseConnectedRef.current = false;
			}
		};
	}, [sessionId, status, stopPolling, startPolling]);

	// Polling fallback — only if SSE is not connected
	useEffect(() => {
		if (
			sessionId &&
			!isPolling &&
			!sseConnectedRef.current &&
			!hasStartedRef.current
		) {
			if (ACTIVE_STATUSES.has(status)) {
				hasStartedRef.current = true;
				startPolling();
			}
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

	return { refresh, isStreaming: sseConnectedRef.current };
}

/**
 * Apply a status update from SSE directly to the store.
 */
function applyStatusUpdate(data: Record<string, unknown>) {
	const newState: Partial<MovieState> = {
		messages: (data.messages as MovieState["messages"]) || [],
		pendingQuestions:
			(data.pending_questions as MovieState["pendingQuestions"]) || [],
		reviewScore: (data.review_score as number) ?? null,
		error: (data.error as string) ?? null,
	};

	const apiStatus = data.status as string;
	if (apiStatus === "completed") {
		newState.status = "completed";
		newState.assembledTimeline =
			(data.assembled_timeline as Record<string, unknown>) ?? null;
		useMovieStore.getState().stopPolling();
	} else if (apiStatus === "failed") {
		newState.status = "failed";
		useMovieStore.getState().stopPolling();
	} else if (apiStatus === "waiting_qa") {
		newState.status = "paused_checkpoint";
	} else if (apiStatus === "waiting_approval") {
		newState.status = "waiting_approval";
	} else if (apiStatus === "waiting_storyboard_approval") {
		newState.status = "waiting_storyboard_approval";
	} else {
		newState.status = "processing";
	}

	// Parse scene statuses and counts
	if (data.scene_statuses) {
		newState.sceneStatuses =
			data.scene_statuses as MovieState["sceneStatuses"];
	}
	if (data.scenes_completed !== undefined) {
		newState.scenesCompleted = data.scenes_completed as number;
	}
	if (data.scenes_total !== undefined) {
		newState.scenesTotal = data.scenes_total as number;
	}

	// Parse acts progress
	if (data.acts_progress) {
		const actsProgress: Record<string, ActProgress> = {};
		for (const [key, value] of Object.entries(
			data.acts_progress as Record<string, Record<string, unknown>>,
		)) {
			actsProgress[key] = {
				status: (value.status as string) || "processing",
				scenesTotal: (value.scenes_total as number) || 0,
				scenesCompleted: (value.scenes_completed as number) || 0,
			};
		}
		newState.actsProgress = actsProgress;
	}

	useMovieStore.setState(newState);
}
