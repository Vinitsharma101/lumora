import { create } from "zustand";
import { apiFetch } from "@/lib/api-client";

export type MovieStatus =
	| "idle"
	| "configuring"
	| "waiting_approval"
	| "waiting_storyboard_approval"
	| "processing"
	| "paused_checkpoint"
	| "completed"
	| "failed";

export type SceneStatus = "pending" | "processing" | "completed" | "failed";

export interface ShowBible {
	title: string;
	logline: string;
	genre: string;
	contentType: string;
	visualStyle: string;
	colorPalette: string[];
	rules: string[];
	editingStrategy: {
		pacingNotes: string;
		musicStrategy: string;
		captionStrategy: string;
		brollStrategy: string;
		transitionPalette: string[];
		targetCutsPerMinute: number;
	};
	characters: Array<{
		charId: string;
		name: string;
		description: string;
		role: string;
		arc: string;
		voiceDescription: string;
	}>;
}

export interface ActPlan {
	actNumber: number;
	title: string;
	description: string;
	scenes: Array<{
		sceneNumber: number;
		description: string;
		location: string;
		mood: string;
		estimatedDurationSeconds: number;
	}>;
}

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
	showBible: ShowBible | null;
	acts: ActPlan[];
	sceneStatuses: Record<string, SceneStatus>;
	scenesCompleted: number;
	scenesTotal: number;
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
	approveStoryboard: (feedback?: string) => Promise<void>;
	approveCheckpoint: (feedback?: string) => Promise<void>;
	regenerateScene: (sceneIndex: number, prompt?: string) => Promise<void>;
	importTimeline: () => Promise<void>;
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
	showBible: null,
	acts: [],
	sceneStatuses: {},
	scenesCompleted: 0,
	scenesTotal: 0,
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
			const { projectId, query, context, duration, style, characters } = get();
			if (!projectId || !query) return;

			try {
				set({ status: "processing", error: null });

				// Register characters for consistency before starting pipeline
				for (const character of characters) {
					await apiFetch(`/api/agent/character/${projectId}`, {
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

				const response = await apiFetch(`/api/agent/execute/${projectId}`, {
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
				});

				if (!response.ok) {
					throw new Error(`Failed to start pipeline: ${response.statusText}`);
				}

				const data = await response.json();
				set({ sessionId: data.session_id, status: "processing" });
				get().startPolling();
			} catch (error) {
				set({
					status: "failed",
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		},

		submitAnswer: async (questionId, value) => {
			const { sessionId } = get();
			if (!sessionId) return;

			await apiFetch(`/api/agent/answer/${sessionId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ question_id: questionId, value }),
			});
		},

		approveCostEstimate: async () => {
			const { sessionId } = get();
			if (!sessionId) return;

			await apiFetch(`/api/agent/approve/${sessionId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ checkpoint: "cost_approval", approved: true }),
			});
			set({ status: "processing" });
		},

		approveStoryboard: async (feedback) => {
			const { sessionId } = get();
			if (!sessionId) return;

			await apiFetch(`/api/agent/approve/${sessionId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					checkpoint: "storyboard",
					approved: true,
					feedback: feedback ?? null,
				}),
			});
			set({ status: "processing" });
		},

		importTimeline: async () => {
			const { sessionId } = get();
			if (!sessionId) return;

			const { importAgentTimeline } = await import("@/lib/ai/timeline-import");
			await importAgentTimeline(sessionId);
		},

		regenerateScene: async (sceneIndex, prompt) => {
			const { sessionId, sceneStatuses } = get();
			if (!sessionId) return;

			await apiFetch(`/api/agent/regenerate/${sessionId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					scene_index: sceneIndex,
					modified_prompt: prompt ?? null,
				}),
			});

			// Reset scene status and resume polling
			set({
				sceneStatuses: {
					...sceneStatuses,
					[String(sceneIndex)]: "pending" as SceneStatus,
				},
				status: "processing",
			});
			get().startPolling();
		},

		approveCheckpoint: async (feedback) => {
			const { sessionId } = get();
			if (!sessionId) return;

			await apiFetch(`/api/agent/approve/${sessionId}`, {
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
				const response = await apiFetch(`/api/agent/status/${sessionId}`);
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
					newState.costEstimate = data.cost_estimate
						? {
								totalEstimatedUsd: data.cost_estimate.total_estimated_usd ?? 0,
								breakdown: data.cost_estimate.breakdown ?? {},
								counts: data.cost_estimate.counts ?? {
									scenes: 0,
									shots: 0,
									dialogLines: 0,
									characters: 0,
								},
							}
						: null;
				} else if (apiStatus === "waiting_storyboard_approval") {
					newState.status = "waiting_storyboard_approval";
				} else {
					newState.status = "processing";
				}

				// Parse show bible
				if (data.show_bible) {
					const bible = data.show_bible;
					const strategy = bible.editing_strategy || {};
					newState.showBible = {
						title: bible.title || "",
						logline: bible.logline || "",
						genre: bible.genre || "",
						contentType: bible.content_type || "",
						visualStyle: bible.visual_style || "",
						colorPalette: bible.color_palette || [],
						rules: bible.rules || [],
						editingStrategy: {
							pacingNotes: strategy.pacing_notes || "",
							musicStrategy: strategy.music_strategy || "",
							captionStrategy: strategy.caption_strategy || "",
							brollStrategy: strategy.broll_strategy || "",
							transitionPalette: strategy.transition_palette || [],
							targetCutsPerMinute: strategy.target_cuts_per_minute || 0,
						},
						characters: (bible.characters || []).map(
							(c: Record<string, unknown>) => ({
								charId: c.char_id || "",
								name: c.name || "",
								description: c.description || "",
								role: c.role || "",
								arc: c.arc || "",
								voiceDescription: c.voice_description || "",
							}),
						),
					};
				}

				// Parse acts
				if (data.acts && Array.isArray(data.acts)) {
					newState.acts = data.acts.map((act: Record<string, unknown>) => ({
						actNumber: act.act_number || 0,
						title: act.title || "",
						description: act.description || "",
						scenes: ((act.scenes as Array<Record<string, unknown>>) || []).map(
							(s) => ({
								sceneNumber: s.scene_number || 0,
								description: s.description || "",
								location: s.location || "",
								mood: s.mood || "",
								estimatedDurationSeconds: s.estimated_duration_seconds || 0,
							}),
						),
					}));
				}

				// Parse scene statuses and counts
				if (data.scene_statuses) {
					newState.sceneStatuses = data.scene_statuses;
				}
				if (data.scenes_completed !== undefined) {
					newState.scenesCompleted = data.scenes_completed;
				}
				if (data.scenes_total !== undefined) {
					newState.scenesTotal = data.scenes_total;
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
					newState.scenes = scenes.map((s: Record<string, unknown>) => ({
						sceneNumber: s.scene_number,
						description: s.description,
						location: s.location || "",
						charactersPresent: s.characters_present || [],
						estimatedDurationSeconds: s.estimated_duration_seconds || 0,
						tensionLevel: s.tension_level || 5,
						mood: s.mood || "",
						actNumber: s.act_number || 1,
					}));
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
