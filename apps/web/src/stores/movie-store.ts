import { create } from "zustand";

export type MovieStatus =
	| "idle"
	| "configuring"
	| "waiting_approval"
	| "processing"
	| "paused_checkpoint"
	| "completed"
	| "failed";

export interface MovieCharacter {
	charId: string;
	name: string;
	description: string;
	referenceImageUrl: string | null;
	voiceDescription: string | null;
}

export interface MovieScene {
	sceneNumber: number;
	description: string;
	location: string;
	charactersPresent: string[];
	estimatedDurationSeconds: number;
	tensionLevel: number;
	mood: string;
	actNumber: number;
}

export interface ActProgress {
	status: string;
	scenesTotal: number;
	scenesCompleted: number;
}

export interface CostEstimate {
	totalEstimatedUsd: number;
	breakdown: Record<string, number>;
	counts: {
		scenes: number;
		shots: number;
		dialogLines: number;
		characters: number;
	};
}

export interface AgentMessage {
	role: "user" | "agent";
	content: string;
}

export interface MovieState {
	sessionId: string | null;
	projectId: string | null;
	status: MovieStatus;
	query: string;
	context: Record<string, unknown>;
	duration: number;
	style: string;

	// Pipeline data
	characters: MovieCharacter[];
	scenes: MovieScene[];
	actsProgress: Record<string, ActProgress>;
	costEstimate: CostEstimate | null;
	messages: AgentMessage[];
	pendingQuestions: Array<{
		id: string;
		question: string;
		options: string[];
	}>;
	reviewScore: number | null;
	assembledTimeline: Record<string, unknown> | null;
	error: string | null;

	// Polling
	isPolling: boolean;
	pollIntervalMs: number;
}

export interface MovieActions {
	setQuery: (query: string) => void;
	setDuration: (minutes: number) => void;
	setStyle: (style: string) => void;
	setProjectId: (projectId: string) => void;
	addCharacter: (character: MovieCharacter) => void;
	removeCharacter: (charId: string) => void;
	updateCharacter: (charId: string, updates: Partial<MovieCharacter>) => void;

	startPipeline: () => Promise<void>;
	submitAnswer: (questionId: string, value: string) => Promise<void>;
	approveCostEstimate: () => Promise<void>;
	approveCheckpoint: (feedback?: string) => Promise<void>;
	regenerateScene: (sceneIndex: number, prompt?: string) => Promise<void>;
	pollStatus: () => Promise<void>;
	startPolling: () => void;
	stopPolling: () => void;
	reset: () => void;
}

const initialState: MovieState = {
	sessionId: null,
	projectId: null,
	status: "idle",
	query: "",
	context: {},
	duration: 60,
	style: "cinematic",
	characters: [],
	scenes: [],
	actsProgress: {},
	costEstimate: null,
	messages: [],
	pendingQuestions: [],
	reviewScore: null,
	assembledTimeline: null,
	error: null,
	isPolling: false,
	pollIntervalMs: 3000,
};

export const useMovieStore = create<MovieState & MovieActions>((set, get) => {
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	return {
		...initialState,

		setQuery: (query) => set({ query }),
		setDuration: (minutes) => set({ duration: minutes }),
		setStyle: (style) => set({ style }),
		setProjectId: (projectId) => set({ projectId }),

		addCharacter: (character) =>
			set((state) => ({ characters: [...state.characters, character] })),

		removeCharacter: (charId) =>
			set((state) => ({
				characters: state.characters.filter((c) => c.charId !== charId),
			})),

		updateCharacter: (charId, updates) =>
			set((state) => ({
				characters: state.characters.map((c) =>
					c.charId === charId ? { ...c, ...updates } : c,
				),
			})),

		startPipeline: async () => {
			const { projectId, query, context, duration, style, characters } =
				get();
			if (!projectId || !query) return;

			try {
				set({ status: "processing", error: null });

				// Register characters for consistency before starting pipeline
				for (const character of characters) {
					await fetch(`/api/agent/character/${projectId}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							name: character.name,
							description: character.description,
							reference_image_url: character.referenceImageUrl,
						}),
					});
				}

				const characterProfiles: Record<
					string,
					{ name: string; description: string }
				> = {};
				for (const character of characters) {
					characterProfiles[character.charId] = {
						name: character.name,
						description: character.description,
					};
				}

				const response = await fetch(
					`/api/agent/execute/${projectId}`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							query: `Create a ${duration}-minute ${style} movie: ${query}`,
							context: {
								...context,
								duration,
								style,
								character_profiles: characterProfiles,
							},
							media_asset_ids: [],
						}),
					},
				);

				if (!response.ok) {
					throw new Error(
						`Failed to start pipeline: ${response.statusText}`,
					);
				}

				const data = await response.json();
				set({ sessionId: data.session_id, status: "processing" });
				get().startPolling();
			} catch (error) {
				set({
					status: "failed",
					error:
						error instanceof Error
							? error.message
							: "Unknown error",
				});
			}
		},

		submitAnswer: async (questionId, value) => {
			const { sessionId } = get();
			if (!sessionId) return;

			await fetch(`/api/agent/answer/${sessionId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ question_id: questionId, value }),
			});
		},

		approveCostEstimate: async () => {
			const { sessionId } = get();
			if (!sessionId) return;

			await fetch(`/api/agent/approve/${sessionId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ checkpoint: "cost_approval", approved: true }),
			});
			set({ status: "processing" });
		},

		regenerateScene: async (sceneIndex, prompt) => {
			const { sessionId } = get();
			if (!sessionId) return;

			await fetch(`/api/agent/regenerate/${sessionId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					scene_index: sceneIndex,
					modified_prompt: prompt ?? null,
				}),
			});
		},

		approveCheckpoint: async (feedback) => {
			const { sessionId } = get();
			if (!sessionId) return;

			await fetch(`/api/agent/approve/${sessionId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					checkpoint: "final_review",
					approved: true,
					feedback,
				}),
			});
			set({ status: "processing" });
		},

		pollStatus: async () => {
			const { sessionId } = get();
			if (!sessionId) return;

			try {
				const response = await fetch(
					`/api/agent/status/${sessionId}`,
				);
				if (!response.ok) return;

				const data = await response.json();

				const newState: Partial<MovieState> = {
					messages: data.messages || [],
					pendingQuestions: data.pending_questions || [],
					reviewScore: data.review_score ?? null,
					error: data.error ?? null,
				};

				// Map API status to store status
				const apiStatus = data.status;
				if (apiStatus === "completed") {
					newState.status = "completed";
					newState.assembledTimeline = data.assembled_timeline ?? null;
					get().stopPolling();
				} else if (apiStatus === "failed") {
					newState.status = "failed";
					get().stopPolling();
				} else if (apiStatus === "waiting_qa") {
					newState.status = "paused_checkpoint";
				} else if (apiStatus === "waiting_approval") {
					newState.status = "waiting_approval";
					newState.costEstimate = data.cost_estimate ? {
						totalEstimatedUsd: data.cost_estimate.total_estimated_usd ?? 0,
						breakdown: data.cost_estimate.breakdown ?? {},
						counts: data.cost_estimate.counts ?? { scenes: 0, shots: 0, dialogLines: 0, characters: 0 },
					} : null;
				} else {
					newState.status = "processing";
				}

				// Update acts progress
				if (data.acts_progress) {
					const actsProgress: Record<string, ActProgress> = {};
					for (const [key, value] of Object.entries(data.acts_progress)) {
						const actData = value as Record<string, unknown>;
						actsProgress[key] = {
							status: (actData.status as string) || "processing",
							scenesTotal: (actData.scenes_total as number) || 0,
							scenesCompleted: (actData.scenes_completed as number) || 0,
						};
					}
					newState.actsProgress = actsProgress;
				}

				// Parse scenes from plan
				if (data.scene_plan) {
					const scenes = Array.isArray(data.scene_plan)
						? data.scene_plan
						: data.scene_plan.scenes || [];
					newState.scenes = scenes.map(
						(s: Record<string, unknown>) => ({
							sceneNumber: s.scene_number,
							description: s.description,
							location: s.location || "",
							charactersPresent: s.characters_present || [],
							estimatedDurationSeconds:
								s.estimated_duration_seconds || 0,
							tensionLevel: s.tension_level || 5,
							mood: s.mood || "",
							actNumber: s.act_number || 1,
						}),
					);
				}

				set(newState);
			} catch {
				// Polling errors are non-fatal
			}
		},

		startPolling: () => {
			const { isPolling, pollIntervalMs } = get();
			if (isPolling) return;

			set({ isPolling: true });
			pollTimer = setInterval(() => {
				get().pollStatus();
			}, pollIntervalMs);
		},

		stopPolling: () => {
			if (pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
			set({ isPolling: false });
		},

		reset: () => {
			get().stopPolling();
			set(initialState);
		},
	};
});
