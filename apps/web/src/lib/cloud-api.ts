/**
 * Cloud platform API client.
 *
 * Typed wrappers around apiFetch for projects, media, render, AI video,
 * auto-edit, and collaboration endpoints.
 */

import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types — mirror the Pydantic schemas from the backend
// ---------------------------------------------------------------------------

export interface ProjectResponse {
	id: string;
	name: string;
	description: string | null;
	thumbnail_url: string | null;
	settings: Record<string, unknown> | null;
	scenes: Array<Record<string, unknown>> | null;
	width: number;
	height: number;
	fps: number;
	duration: number;
	created_at: string;
	updated_at: string;
}

export interface MediaAssetResponse {
	id: string;
	project_id: string;
	name: string;
	file_type: string;
	mime_type: string | null;
	file_size: number;
	storage_path: string;
	public_url: string | null;
	width: number | null;
	height: number | null;
	duration: number | null;
	fps: number | null;
	thumbnail_url: string | null;
	created_at: string;
}

export interface RenderJobResponse {
	job_id: string;
	status: string;
	progress: number;
	output_url: string | null;
	output_size: number | null;
	format: string;
	quality: string;
	created_at: string;
	completed_at: string | null;
	error_message: string | null;
}

export interface AIJobResponse {
	job_id: string;
	status: string;
	job_type: string;
	progress: number;
	current_step: string | null;
	chunks_total: number;
	chunks_completed: number;
	error_message: string | null;
	output_url: string | null;
	output_data: Record<string, unknown> | null;
	provider: string | null;
	created_at?: string;
	completed_at?: string | null;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function jsonOrThrow<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`API error ${response.status}: ${body}`);
	}
	return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProject({
	name,
	description,
	settings,
	scenes,
	width,
	height,
	fps,
}: {
	name: string;
	description?: string;
	settings?: Record<string, unknown>;
	scenes?: Array<Record<string, unknown>>;
	width?: number;
	height?: number;
	fps?: number;
}): Promise<ProjectResponse> {
	const response = await apiFetch("/api/projects", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name,
			description,
			settings,
			scenes,
			width,
			height,
			fps,
		}),
	});
	return jsonOrThrow<ProjectResponse>(response);
}

export async function listProjects(): Promise<{ projects: ProjectResponse[] }> {
	const response = await apiFetch("/api/projects");
	return jsonOrThrow<{ projects: ProjectResponse[] }>(response);
}

export async function getProject({
	projectId,
}: {
	projectId: string;
}): Promise<ProjectResponse> {
	const response = await apiFetch(`/api/projects/${projectId}`);
	return jsonOrThrow<ProjectResponse>(response);
}

export async function updateProject({
	projectId,
	data,
}: {
	projectId: string;
	data: Partial<{
		name: string;
		description: string;
		settings: Record<string, unknown>;
		scenes: Array<Record<string, unknown>>;
		width: number;
		height: number;
		fps: number;
		duration: number;
	}>;
}): Promise<ProjectResponse> {
	const response = await apiFetch(`/api/projects/${projectId}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	return jsonOrThrow<ProjectResponse>(response);
}

export async function deleteProject({
	projectId,
}: {
	projectId: string;
}): Promise<void> {
	const response = await apiFetch(`/api/projects/${projectId}`, {
		method: "DELETE",
	});
	if (!response.ok) {
		throw new Error(`Failed to delete project: ${response.status}`);
	}
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export async function uploadMedia({
	projectId,
	file,
}: {
	projectId: string;
	file: File;
}): Promise<MediaAssetResponse> {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("project_id", projectId);

	const response = await apiFetch("/api/media/upload", {
		method: "POST",
		body: formData,
	});
	return jsonOrThrow<MediaAssetResponse>(response);
}

export async function listMediaAssets({
	projectId,
}: {
	projectId: string;
}): Promise<{ assets: MediaAssetResponse[] }> {
	const response = await apiFetch(`/api/media/${projectId}`);
	return jsonOrThrow<{ assets: MediaAssetResponse[] }>(response);
}

export async function deleteMediaAsset({
	projectId,
	assetId,
}: {
	projectId: string;
	assetId: string;
}): Promise<void> {
	const response = await apiFetch(`/api/media/${projectId}/${assetId}`, {
		method: "DELETE",
	});
	if (!response.ok) {
		throw new Error(`Failed to delete media: ${response.status}`);
	}
}

// ---------------------------------------------------------------------------
// Render / Export
// ---------------------------------------------------------------------------

export async function startRender({
	projectId,
	timelineData,
	format,
	quality,
	width,
	height,
	fps,
}: {
	projectId: string;
	timelineData: Record<string, unknown>;
	format?: string;
	quality?: string;
	width?: number;
	height?: number;
	fps?: number;
}): Promise<RenderJobResponse> {
	const response = await apiFetch("/api/render", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			project_id: projectId,
			timeline_data: timelineData,
			format,
			quality,
			width,
			height,
			fps,
		}),
	});
	return jsonOrThrow<RenderJobResponse>(response);
}

export async function getRenderStatus({
	jobId,
}: {
	jobId: string;
}): Promise<RenderJobResponse> {
	const response = await apiFetch(`/api/render/${jobId}`);
	return jsonOrThrow<RenderJobResponse>(response);
}

export function streamRenderProgress({
	jobId,
	onProgress,
	onComplete,
	onError,
}: {
	jobId: string;
	onProgress: (data: { progress: number; status: string }) => void;
	onComplete: (data: RenderJobResponse) => void;
	onError: (error: Error) => void;
}): () => void {
	const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
	const eventSource = new EventSource(`${apiUrl}/api/render/${jobId}/stream`);

	eventSource.onmessage = (event) => {
		try {
			const data = JSON.parse(event.data) as Record<string, unknown>;
			if (data.status === "completed") {
				onComplete(data as unknown as RenderJobResponse);
				eventSource.close();
			} else if (data.status === "failed") {
				onError(new Error((data.error_message as string) || "Render failed"));
				eventSource.close();
			} else {
				onProgress({
					progress: (data.progress as number) || 0,
					status: (data.status as string) || "processing",
				});
			}
		} catch {
			// Ignore parse errors from SSE
		}
	};

	eventSource.onerror = () => {
		onError(new Error("SSE connection lost"));
		eventSource.close();
	};

	return () => eventSource.close();
}

// ---------------------------------------------------------------------------
// AI Video Generation
// ---------------------------------------------------------------------------

export async function generateTextToVideo({
	prompt,
	duration,
	aspectRatio,
	provider,
	projectId,
}: {
	prompt: string;
	duration?: number;
	aspectRatio?: string;
	provider?: string;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/text-to-video", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			prompt,
			duration,
			aspect_ratio: aspectRatio,
			provider,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function generateImageToVideo({
	imageUrl,
	prompt,
	duration,
	provider,
	projectId,
}: {
	imageUrl: string;
	prompt?: string;
	duration?: number;
	provider?: string;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/image-to-video", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			image_url: imageUrl,
			prompt,
			duration,
			provider,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function generateScriptToScenes({
	script,
	style,
	aspectRatio,
	projectId,
}: {
	script: string;
	style?: string;
	aspectRatio?: string;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/script-to-scenes", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			script,
			style,
			aspect_ratio: aspectRatio,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function removeBackground({
	imageUrl,
	projectId,
}: {
	imageUrl: string;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/background-remove", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			image_url: imageUrl,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function upscaleImage({
	imageUrl,
	scale,
	projectId,
}: {
	imageUrl: string;
	scale?: number;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/upscale", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			image_url: imageUrl,
			scale,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function styleTransfer({
	imageUrl,
	stylePreset,
	strength,
	projectId,
}: {
	imageUrl: string;
	stylePreset: string;
	strength?: number;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/style-transfer", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			image_url: imageUrl,
			style_preset: stylePreset,
			strength,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function getAIJobStatus({
	jobId,
}: {
	jobId: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch(`/api/ai/jobs/${jobId}`);
	return jsonOrThrow<AIJobResponse>(response);
}

// ── New AI Capabilities ──

export async function generateTextToImage({
	prompt,
	width,
	height,
	model,
	provider,
	aspectRatio,
	numImages,
	negativePrompt,
	stylePreset,
	styleReferenceUrls,
	seed,
	projectId,
}: {
	prompt: string;
	width?: number;
	height?: number;
	model?: "schnell" | "dev";
	provider?: "replicate" | "google_imagen" | "openai";
	aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
	numImages?: number;
	negativePrompt?: string;
	stylePreset?: string;
	styleReferenceUrls?: string[];
	seed?: number;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/video/text-to-image", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			prompt,
			width,
			height,
			model,
			provider,
			aspect_ratio: aspectRatio,
			num_images: numImages,
			negative_prompt: negativePrompt || undefined,
			style_preset: stylePreset || undefined,
			style_reference_urls:
				styleReferenceUrls && styleReferenceUrls.length > 0
					? styleReferenceUrls
					: undefined,
			seed: seed ?? undefined,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function editImage({
	sourceImageUrl,
	editPrompt,
	provider,
	projectId,
}: {
	sourceImageUrl: string;
	editPrompt: string;
	provider?: "replicate" | "google_imagen" | "openai";
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/video/edit-image", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			source_image_url: sourceImageUrl,
			edit_prompt: editPrompt,
			provider,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function transformVideoToVideo({
	videoUrl,
	prompt,
	strength,
	projectId,
}: {
	videoUrl: string;
	prompt: string;
	strength?: number;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/video/video-to-video", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			video_url: videoUrl,
			prompt,
			strength,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function understandMedia({
	mediaUrl,
	mediaType,
	question,
	projectId,
}: {
	mediaUrl: string;
	mediaType: "image" | "video" | "audio";
	question?: string;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/video/understand-media", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			media_url: mediaUrl,
			media_type: mediaType,
			question,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function generateSpeech({
	text,
	voiceId,
	modelId,
	stability,
	similarityBoost,
	projectId,
}: {
	text: string;
	voiceId?: string;
	modelId?: string;
	stability?: number;
	similarityBoost?: number;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/voice/tts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			text,
			voice_id: voiceId,
			model_id: modelId,
			stability,
			similarity_boost: similarityBoost,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function generateSoundEffect({
	prompt,
	durationSeconds,
	projectId,
}: {
	prompt: string;
	durationSeconds?: number;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/ai/voice/sfx", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			prompt,
			duration_seconds: durationSeconds,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export interface VoiceInfo {
	voice_id: string;
	name: string;
	category: string;
	description: string;
	preview_url: string | null;
	labels: Record<string, string>;
}

export async function listVoices(): Promise<{ voices: VoiceInfo[] }> {
	const response = await apiFetch("/api/ai/voice/voices");
	return jsonOrThrow<{ voices: VoiceInfo[] }>(response);
}

// ── Agent Pipeline ──

export interface AgentSessionStatus {
	session_id: string;
	status: string;
	pending_questions: Array<{
		id: string;
		question: string;
		category: string;
		options: Array<{ value: string; label: string }>;
	}>;
	scene_plan: Record<string, unknown> | null;
	generated_assets_count: number;
	assembled_timeline: Record<string, unknown> | null;
	review_score: number | null;
	review_suggestions: string[];
	messages: Array<{ role: string; content: string }>;
	error: string | null;
}

export async function startAgentSession({
	projectId,
	query,
	context,
	mediaAssetIds,
}: {
	projectId: string;
	query: string;
	context?: Record<string, unknown>;
	mediaAssetIds?: string[];
}): Promise<{ session_id: string; status: string }> {
	const response = await apiFetch(`/api/agent/execute/${projectId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			query,
			context: context ?? {},
			media_asset_ids: mediaAssetIds ?? [],
		}),
	});
	return jsonOrThrow<{ session_id: string; status: string }>(response);
}

export async function submitAgentAnswer({
	sessionId,
	questionId,
	value,
}: {
	sessionId: string;
	questionId: string;
	value: string;
}): Promise<{ status: string }> {
	const response = await apiFetch(`/api/agent/answer/${sessionId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			question_id: questionId,
			value,
		}),
	});
	return jsonOrThrow<{ status: string }>(response);
}

export async function getAgentSessionStatus({
	sessionId,
}: {
	sessionId: string;
}): Promise<AgentSessionStatus> {
	const response = await apiFetch(`/api/agent/status/${sessionId}`);
	return jsonOrThrow<AgentSessionStatus>(response);
}


export async function analyzeVideo({
	videoUrl,
	detectScenes,
	detectSilence,
	detectHighlights,
	transcribe,
	projectId,
}: {
	videoUrl: string;
	detectScenes?: boolean;
	detectSilence?: boolean;
	detectHighlights?: boolean;
	transcribe?: boolean;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/auto-edit/analyze", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			video_url: videoUrl,
			detect_scenes: detectScenes,
			detect_silence: detectSilence,
			detect_highlights: detectHighlights,
			transcribe,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function removeSilence({
	videoUrl,
	minSilenceDuration,
	silenceThreshold,
	projectId,
}: {
	videoUrl: string;
	minSilenceDuration?: number;
	silenceThreshold?: number;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/auto-edit/silence-remove", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			video_url: videoUrl,
			min_silence_duration: minSilenceDuration,
			silence_threshold: silenceThreshold,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function generateCaptions({
	videoUrl,
	language,
	style,
	projectId,
}: {
	videoUrl: string;
	language?: string;
	style?: string;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/auto-edit/captions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			video_url: videoUrl,
			language,
			style,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function createShorts({
	videoUrl,
	maxDuration,
	count,
	aspectRatio,
	projectId,
}: {
	videoUrl: string;
	maxDuration?: number;
	count?: number;
	aspectRatio?: string;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/auto-edit/shorts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			video_url: videoUrl,
			max_duration: maxDuration,
			count,
			aspect_ratio: aspectRatio,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

export async function beatSync({
	videoUrl,
	musicUrl,
	projectId,
}: {
	videoUrl: string;
	musicUrl: string;
	projectId?: string;
}): Promise<AIJobResponse> {
	const response = await apiFetch("/api/auto-edit/beat-sync", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			video_url: videoUrl,
			music_url: musicUrl,
			project_id: projectId,
		}),
	});
	return jsonOrThrow<AIJobResponse>(response);
}

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

export async function shareProject({
	projectId,
	email,
	role,
}: {
	projectId: string;
	email: string;
	role?: string;
}): Promise<Record<string, unknown>> {
	const response = await apiFetch(`/api/projects/${projectId}/share`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, role }),
	});
	return jsonOrThrow<Record<string, unknown>>(response);
}

export async function listCollaborators({
	projectId,
}: {
	projectId: string;
}): Promise<{ collaborators: Array<Record<string, unknown>> }> {
	const response = await apiFetch(`/api/projects/${projectId}/collaborators`);
	return jsonOrThrow<{ collaborators: Array<Record<string, unknown>> }>(
		response,
	);
}

export async function removeCollaborator({
	projectId,
	collaboratorId,
}: {
	projectId: string;
	collaboratorId: string;
}): Promise<void> {
	const response = await apiFetch(
		`/api/projects/${projectId}/collaborators/${collaboratorId}`,
		{ method: "DELETE" },
	);
	if (!response.ok) {
		throw new Error(`Failed to remove collaborator: ${response.status}`);
	}
}
