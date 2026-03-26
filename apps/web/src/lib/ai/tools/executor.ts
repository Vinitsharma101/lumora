import { EditorCore } from "@/core";
import { apiFetch } from "@/lib/api-client";
import {
	buildTextElement,
	buildLibraryAudioElement,
} from "@/lib/timeline/element-utils";
import { processMediaAssets } from "@/lib/media/processing";
import { serializeEditorContext } from "../context";
import { AiEditingOrchestrator, getStyleProfileSummary } from "../editing";
import { importAgentTimeline } from "../timeline-import";
import type { ToolCall } from "../providers/types";

export interface ToolExecutionResult {
	success: boolean;
	result: string;
	description: string;
}

const MOTION_TEMPLATES = [
	{
		id: "lower-third",
		name: "Lower Third",
		description: "Animated lower-third name/title bar",
		props: {
			primaryText: "string",
			secondaryText: "string",
			accentColor: "string",
		},
	},
	{
		id: "title-card",
		name: "Title Card",
		description: "Intro/outro title card with animation",
		props: { title: "string", subtitle: "string", background: "string" },
	},
	{
		id: "subscribe-cta",
		name: "Subscribe CTA",
		description: "Animated subscribe/like/share overlay",
		props: { channelName: "string", accentColor: "string" },
	},
	{
		id: "countdown",
		name: "Countdown",
		description: "Countdown timer animation",
		props: { from: "number", color: "string" },
	},
	{
		id: "text-reveal",
		name: "Text Reveal",
		description: "Cinematic text reveal animation",
		props: { text: "string", color: "string", background: "string" },
	},
];

export async function executeToolCall(
	toolCall: ToolCall,
): Promise<ToolExecutionResult> {
	const editor = EditorCore.getInstance();
	const args = toolCall.arguments;

	try {
		switch (toolCall.name) {
			// ── Read Operations ──
			case "get_timeline_state": {
				const context = serializeEditorContext(editor);
				return {
					success: true,
					result: JSON.stringify(context, null, 2),
					description: "Reading timeline state",
				};
			}

			case "get_project_settings": {
				const project = editor.project.getActive();
				const settings = project?.settings ?? null;
				return {
					success: true,
					result: JSON.stringify(settings, null, 2),
					description: "Reading project settings",
				};
			}

			case "get_media_assets": {
				const assets = editor.media.getAssets();
				const summary = assets.map((a) => ({
					id: a.id,
					name: a.name,
					type: a.type,
					duration: a.duration,
				}));
				return {
					success: true,
					result: JSON.stringify(summary, null, 2),
					description: "Listing media assets",
				};
			}

			// ── Text/Caption ──
			case "add_text_caption": {
				const content = args.content as string;
				const startTime = args.startTime as number;
				const duration = (args.duration as number) ?? 5;
				const fontSize = (args.fontSize as number) ?? 15;
				const fontFamily = (args.fontFamily as string) ?? "Arial";
				const color = (args.color as string) ?? "#ffffff";
				const backgroundColor = (args.backgroundColor as string) ?? "#000000";
				const textAlign =
					(args.textAlign as "left" | "center" | "right") ?? "center";
				const fontWeight = (args.fontWeight as "normal" | "bold") ?? "normal";
				const positionX = (args.positionX as number) ?? 0;
				const positionY = (args.positionY as number) ?? 0;

				const element = buildTextElement({
					raw: {
						name: content.slice(0, 30),
						content,
						duration,
						fontSize,
						fontFamily,
						color,
						background: {
							color:
								backgroundColor === "transparent"
									? "#00000000"
									: backgroundColor,
						},
						textAlign,
						fontWeight,
						transform: {
							scale: 1,
							position: { x: positionX, y: positionY },
							rotate: 0,
						},
					},
					startTime,
				});

				editor.timeline.insertElement({
					element,
					placement: { mode: "auto" },
				});

				return {
					success: true,
					result: `Added text "${content}" at ${startTime}s for ${duration}s`,
					description: `Adding caption "${content.slice(0, 30)}..." at ${startTime}s`,
				};
			}

			case "add_multiple_captions": {
				const captions = args.captions as Array<{
					content: string;
					startTime: number;
					duration: number;
				}>;
				const sharedFontSize = (args.fontSize as number) ?? 15;
				const sharedFontFamily = (args.fontFamily as string) ?? "Inter";
				const sharedColor = (args.color as string) ?? "#ffffff";
				const sharedBg = (args.backgroundColor as string) ?? "transparent";
				const sharedPosY = (args.positionY as number) ?? 0.35;
				const animationType = (args.animation as string) ?? "none";

				// Build all elements first, then insert as a single atomic batch
				// so that Cmd+Z removes all captions in one undo step.
				const items = captions.map((cap) => {
					const element = buildTextElement({
						raw: {
							name: cap.content.slice(0, 30),
							content: cap.content,
							duration: cap.duration,
							fontSize: sharedFontSize,
							fontFamily: sharedFontFamily,
							color: sharedColor,
							background: {
								color: sharedBg === "transparent" ? "#00000000" : sharedBg,
							},
							textAlign: "center",
							transform: {
								scale: 1,
								position: { x: 0, y: sharedPosY },
								rotate: 0,
							},
						},
						startTime: cap.startTime,
					});

					if (animationType === "pop_in") {
						element.transitions = [
							{
								id: crypto.randomUUID(),
								type: "scale_up",
								duration: 0.2,
								direction: "in",
							},
						];
					}

					return {
						element,
						placement: { mode: "auto" } as const,
					};
				});

				editor.timeline.insertElements(items);

				return {
					success: true,
					result: `Added ${captions.length} captions to the timeline`,
					description: `Adding ${captions.length} captions`,
				};
			}

			// ── Element Manipulation ──
			case "update_element": {
				const trackId = args.trackId as string;
				const elementId = args.elementId as string;
				const updates = args.updates as Record<string, unknown>;

				editor.timeline.updateElements({
					updates: [{ trackId, elementId, updates }],
				});

				return {
					success: true,
					result: `Updated element ${elementId} with ${Object.keys(updates).join(", ")}`,
					description: `Updating element properties`,
				};
			}

			case "delete_elements": {
				const elements = args.elements as Array<{
					trackId: string;
					elementId: string;
				}>;

				editor.timeline.deleteElements({ elements });

				return {
					success: true,
					result: `Deleted ${elements.length} element(s)`,
					description: `Deleting ${elements.length} element(s)`,
				};
			}

			case "split_element_at_time": {
				const trackId = args.trackId as string;
				const elementId = args.elementId as string;
				const time = args.time as number;

				editor.timeline.splitElements({
					elements: [{ trackId, elementId }],
					splitTime: time,
					retainSide: "both",
				});

				return {
					success: true,
					result: `Split element at ${time}s`,
					description: `Splitting element at ${time}s`,
				};
			}

			case "move_element": {
				const trackId = args.trackId as string;
				const elementId = args.elementId as string;
				const newStartTime = args.newStartTime as number;

				editor.timeline.updateElementStartTime({
					elements: [{ trackId, elementId }],
					startTime: newStartTime,
				});

				return {
					success: true,
					result: `Moved element to ${newStartTime}s`,
					description: `Moving element to ${newStartTime}s`,
				};
			}

			case "set_element_duration": {
				const trackId = args.trackId as string;
				const elementId = args.elementId as string;
				const duration = args.duration as number;

				editor.timeline.updateElementDuration({
					trackId,
					elementId,
					duration,
				});

				return {
					success: true,
					result: `Set element duration to ${duration}s`,
					description: `Setting element duration to ${duration}s`,
				};
			}

			// ── Project Settings ──
			case "set_canvas_size": {
				const width = args.width as number;
				const height = args.height as number;

				await editor.project.updateSettings({
					settings: { canvasSize: { width, height } },
				});

				return {
					success: true,
					result: `Canvas size set to ${width}x${height}`,
					description: `Setting canvas to ${width}x${height}`,
				};
			}

			case "set_background": {
				const color = args.color as string;

				await editor.project.updateSettings({
					settings: { background: { type: "color", color } },
				});

				return {
					success: true,
					result: `Background set to ${color}`,
					description: `Setting background to ${color}`,
				};
			}

			case "seek_to_time": {
				const time = args.time as number;
				editor.playback.seek({ time });

				return {
					success: true,
					result: `Playhead moved to ${time}s`,
					description: `Seeking to ${time}s`,
				};
			}

			// ── External API tools (delegated to API routes) ──
			case "generate_voiceover": {
				const text = args.text as string;
				const startTime = (args.startTime as number) ?? 0;
				const voiceId = args.voiceId as string | undefined;

				const response = await apiFetch("/api/ai/voice/tts", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ text, voice_id: voiceId }),
				});

				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					return {
						success: false,
						result: `Voice generation failed: ${(err as Record<string, string>).detail || "Unknown error"}`,
						description: "Generating voiceover",
					};
				}

				const jobData = await response.json();
				const jobId = jobData.job_id;

				// Poll for completion
				let completedJob = null;
				for (let i = 0; i < 60; i++) {
					await new Promise((resolve) => setTimeout(resolve, 2000));
					const statusRes = await apiFetch(`/api/ai/jobs/${jobId}`);
					if (!statusRes.ok) continue;

					const statusData = await statusRes.json();
					if (statusData.status === "completed") {
						completedJob = statusData;
						break;
					} else if (statusData.status === "failed") {
						return {
							success: false,
							result: `Voice generation failed: ${statusData.error || "Unknown error"}`,
							description: "Generating voiceover",
						};
					}
				}

				if (!completedJob || !completedJob.result?.audio_base64) {
					return {
						success: false,
						result: "Voice generation timed out.",
						description: "Generating voiceover",
					};
				}

				// Decode the base64 result
				const byteCharacters = atob(completedJob.result.audio_base64);
				const byteNumbers = new Array(byteCharacters.length);
				for (let i = 0; i < byteCharacters.length; i++) {
					byteNumbers[i] = byteCharacters.charCodeAt(i);
				}
				const byteArray = new Uint8Array(byteNumbers);
				const blob = new Blob([byteArray], { type: "audio/mpeg" });
				const file = new File([blob], `voiceover-${Date.now()}.mp3`, {
					type: "audio/mpeg",
				});

				const projectId = editor.project.getActive()?.metadata.id;
				if (!projectId) {
					return {
						success: false,
						result: "No active project",
						description: "Generating voiceover",
					};
				}

				const assetName = `Voiceover: ${text.slice(0, 30)}...`;
				const assetsBefore = editor.media.getAssets().length;
				await editor.media.addMediaAsset({
					projectId,
					asset: { file, name: assetName, type: "audio" },
				});
				const assetsAfter = editor.media.getAssets();
				const newAsset = assetsAfter[assetsAfter.length - 1];

				if (!newAsset || assetsAfter.length <= assetsBefore) {
					return {
						success: false,
						result: "Failed to add voiceover asset",
						description: "Generating voiceover",
					};
				}

				editor.timeline.insertElement({
					element: {
						type: "audio",
						sourceType: "upload",
						mediaId: newAsset.id,
						name: assetName,
						duration: 5,
						startTime,
						trimStart: 0,
						trimEnd: 0,
						volume: 1,
						muted: false,
					},
					placement: { mode: "auto" },
				});

				return {
					success: true,
					result: `Voiceover generated and added at ${startTime}s`,
					description: "Generating voiceover",
				};
			}

			case "generate_music": {
				const prompt = args.prompt as string;
				const duration = (args.duration as number) ?? 30;
				const startTime = (args.startTime as number) ?? 0;

				const response = await apiFetch("/api/ai/music", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ prompt, duration }),
				});

				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					return {
						success: false,
						result: `Music generation failed: ${(err as Record<string, string>).detail || "Unknown error"}`,
						description: "Generating music",
					};
				}

				const jobData = await response.json();
				const jobId = jobData.job_id;

				// Poll for completion
				let completedJob = null;
				for (let i = 0; i < 60; i++) {
					await new Promise((resolve) => setTimeout(resolve, 3000));
					const statusRes = await apiFetch(`/api/ai/jobs/${jobId}`);
					if (!statusRes.ok) continue;

					const statusData = await statusRes.json();
					if (statusData.status === "completed") {
						completedJob = statusData;
						break;
					} else if (statusData.status === "failed") {
						return {
							success: false,
							result: `Music generation failed: ${statusData.error || "Unknown error"}`,
							description: "Generating music",
						};
					}
				}

				if (!completedJob || !completedJob.result?.audio_url) {
					return {
						success: false,
						result: "Music generation timed out.",
						description: "Generating music",
					};
				}

				const audioRes = await fetch(completedJob.result.audio_url);
				const blob = await audioRes.blob();
				const file = new File([blob], `music-${Date.now()}.mp3`, {
					type: "audio/mpeg",
				});

				const projectId = editor.project.getActive()?.metadata.id;
				if (!projectId) {
					return {
						success: false,
						result: "No active project",
						description: "Generating music",
					};
				}

				const musicName = `Music: ${prompt.slice(0, 30)}`;
				const musicAssetsBefore = editor.media.getAssets().length;
				await editor.media.addMediaAsset({
					projectId,
					asset: { file, name: musicName, type: "audio" },
				});
				const musicAssetsAfter = editor.media.getAssets();
				const newMusicAsset = musicAssetsAfter[musicAssetsAfter.length - 1];

				if (!newMusicAsset || musicAssetsAfter.length <= musicAssetsBefore) {
					return {
						success: false,
						result: "Failed to add music asset",
						description: "Generating music",
					};
				}

				editor.timeline.insertElement({
					element: {
						type: "audio",
						sourceType: "upload",
						mediaId: newMusicAsset.id,
						name: musicName,
						duration,
						startTime,
						trimStart: 0,
						trimEnd: 0,
						volume: 0.3,
						muted: false,
					},
					placement: { mode: "auto" },
				});

				return {
					success: true,
					result: `Music generated and added at ${startTime}s`,
					description: "Generating background music",
				};
			}

			case "search_stock_video":
			case "search_stock_image": {
				const query = args.query as string;
				const orientation = args.orientation as string | undefined;
				const type = toolCall.name === "search_stock_video" ? "video" : "photo";

				const params = new URLSearchParams({ query, type });
				if (orientation) params.set("orientation", orientation);

				const response = await apiFetch(`/api/ai/stock?${params.toString()}`);
				if (!response.ok) {
					return {
						success: false,
						result: "Stock media search failed",
						description: `Searching for ${type}s`,
					};
				}

				const results = await response.json();
				return {
					success: true,
					result: JSON.stringify(results, null, 2),
					description: `Searching for "${query}" ${type}s`,
				};
			}

			case "add_stock_media_to_timeline": {
				const url = args.url as string;
				const mediaType = args.type as "video" | "image";
				const startTime = args.startTime as number;
				const duration = (args.duration as number) ?? 5;
				const name = (args.name as string) ?? "Stock media";
				const source = args.source as string;

				const response = await apiFetch("/api/ai/stock/download", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ url, type: mediaType, source }),
				});

				if (!response.ok) {
					return {
						success: false,
						result: "Failed to download stock media",
						description: "Downloading stock media",
					};
				}

				const blob = await response.blob();
				const ext = mediaType === "video" ? "mp4" : "jpg";
				const mimeType = mediaType === "video" ? "video/mp4" : "image/jpeg";
				const file = new File([blob], `${name}.${ext}`, { type: mimeType });

				const projectId = editor.project.getActive()?.metadata.id;
				if (!projectId) {
					return {
						success: false,
						result: "No active project",
						description: "Adding stock media",
					};
				}

				const processedAssets = await processMediaAssets({
					files: [file],
				});
				if (processedAssets.length === 0) {
					return {
						success: false,
						result: "Failed to process stock media",
						description: "Processing stock media",
					};
				}
				const processed = processedAssets[0];

				const stockAssetsBefore = editor.media.getAssets().length;
				await editor.media.addMediaAsset({
					projectId,
					asset: {
						file: processed.file,
						name,
						type: mediaType,
						url: processed.url,
						thumbnailUrl: processed.thumbnailUrl,
						width: processed.width,
						height: processed.height,
						duration: processed.duration,
					},
				});
				const stockAssetsAfter = editor.media.getAssets();
				const newStockAsset = stockAssetsAfter[stockAssetsAfter.length - 1];

				if (!newStockAsset || stockAssetsAfter.length <= stockAssetsBefore) {
					return {
						success: false,
						result: "Failed to add stock media asset",
						description: "Adding stock media",
					};
				}

				if (mediaType === "video") {
					editor.timeline.insertElement({
						element: {
							type: "video",
							mediaId: newStockAsset.id,
							name,
							duration,
							startTime,
							trimStart: 0,
							trimEnd: 0,
							muted: false,
							hidden: false,
							transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
							opacity: 1,
						},
						placement: { mode: "auto" },
					});
				} else {
					editor.timeline.insertElement({
						element: {
							type: "image",
							mediaId: newStockAsset.id,
							name,
							duration,
							startTime,
							trimStart: 0,
							trimEnd: 0,
							hidden: false,
							transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
							opacity: 1,
						},
						placement: { mode: "auto" },
					});
				}

				return {
					success: true,
					result: `Added stock ${mediaType} "${name}" at ${startTime}s`,
					description: `Adding stock ${mediaType} to timeline`,
				};
			}

			// ── Motion Graphics ──
			case "add_motion_graphic": {
				const compositionId = args.compositionId as string;
				const props = (args.props as Record<string, unknown>) ?? {};
				const startTime = args.startTime as number;
				const duration = (args.duration as number) ?? 5;
				const canvasWidth =
					editor.project.getActive()?.settings.canvasSize?.width ?? 1920;
				const canvasHeight =
					editor.project.getActive()?.settings.canvasSize?.height ?? 1080;
				const projectFps = editor.project.getActive()?.settings.fps ?? 30;
				const durationInFrames = Math.round(duration * projectFps);

				// Call the Next.js API route (server-side Remotion rendering)
				const response = await fetch("/api/render-motion", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						compositionId,
						props,
						width: canvasWidth,
						height: canvasHeight,
						fps: projectFps,
						durationInFrames,
					}),
				});

				if (!response.ok) {
					const contentType = response.headers.get("content-type");
					let errorMessage = `HTTP ${response.status}`;
					if (contentType?.includes("application/json")) {
						const err = await response.json().catch(() => ({}));
						errorMessage =
							(err as Record<string, string>).error || errorMessage;
					}
					return {
						success: false,
						result: `Motion graphic rendering failed: ${errorMessage}`,
						description: "Rendering motion graphic",
					};
				}

				const blob = await response.blob();
				if (blob.size === 0) {
					return {
						success: false,
						result: "Motion graphic rendering produced an empty video",
						description: "Rendering motion graphic",
					};
				}

				const file = new File([blob], `${compositionId}-${Date.now()}.webm`, {
					type: "video/webm",
				});
				const url = URL.createObjectURL(blob);

				const projectId = editor.project.getActive()?.metadata.id;
				if (!projectId) {
					URL.revokeObjectURL(url);
					return {
						success: false,
						result: "No active project",
						description: "Adding motion graphic",
					};
				}

				const motionAssetsBefore = editor.media.getAssets().length;
				await editor.media.addMediaAsset({
					projectId,
					asset: {
						file,
						url,
						name: `Motion: ${compositionId}`,
						type: "video",
						width: canvasWidth,
						height: canvasHeight,
						duration,
						fps: projectFps,
					},
				});
				const motionAssetsAfter = editor.media.getAssets();
				const newMotionAsset = motionAssetsAfter.at(-1);

				if (!newMotionAsset || motionAssetsAfter.length <= motionAssetsBefore) {
					return {
						success: false,
						result: "Failed to add motion graphic asset",
						description: "Adding motion graphic",
					};
				}

				editor.timeline.insertElement({
					element: {
						type: "video",
						mediaId: newMotionAsset.id,
						name: `Motion: ${compositionId}`,
						duration,
						startTime,
						trimStart: 0,
						trimEnd: 0,
						muted: true,
						hidden: false,
						transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
						opacity: 1,
					},
					placement: { mode: "auto" },
				});

				return {
					success: true,
					result: `Motion graphic "${compositionId}" added at ${startTime}s`,
					description: `Rendering "${compositionId}" motion graphic`,
				};
			}

			case "list_motion_templates": {
				return {
					success: true,
					result: JSON.stringify(MOTION_TEMPLATES, null, 2),
					description: "Listing motion graphic templates",
				};
			}

			// ── AI Image Generation ──
			case "generate_image": {
				const prompt = args.prompt as string;
				const width = (args.width as number) ?? 1024;
				const height = (args.height as number) ?? 1024;
				const provider = (args.provider as string) ?? "replicate";
				const numImages = (args.numImages as number) ?? 1;

				const response = await apiFetch("/api/ai/video/text-to-image", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						prompt,
						width,
						height,
						model: "schnell",
						provider,
						num_images: numImages,
					}),
				});

				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					return {
						success: false,
						result: `Image generation failed: ${(err as Record<string, string>).detail || "Unknown error"}`,
						description: "Generating image",
					};
				}

				const jobData = (await response.json()) as Record<string, string>;

				// Add to image-gen store so it appears in the AI Image gallery
				const { useImageGenStore } = await import(
					"@/stores/image-gen-store"
				);
				useImageGenStore.getState().addImage({
					id: crypto.randomUUID(),
					prompt,
					provider: provider as "replicate" | "google_imagen" | "openai",
					status: "generating",
					urls: [],
					jobId: jobData.job_id,
					parentImageId: null,
					errorMessage: null,
					createdAt: Date.now(),
				});

				return {
					success: true,
					result: `Image generation started (${provider}). Job ID: ${jobData.job_id}. Use poll_job_status to check when it's ready, then import_generated_asset to add it to the timeline.`,
					description: `Generating image: "${prompt.slice(0, 40)}..."`,
				};
			}

			// ── AI Video Generation ──
			case "generate_video": {
				const prompt = args.prompt as string;
				const duration = (args.duration as number) ?? 4;
				const aspectRatio = (args.aspectRatio as string) ?? "16:9";
				const provider = (args.provider as string) ?? "google_veo";

				const response = await apiFetch("/api/ai/video/text-to-video", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						prompt,
						duration,
						aspect_ratio: aspectRatio,
						provider,
					}),
				});

				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					return {
						success: false,
						result: `Video generation failed: ${(err as Record<string, string>).detail || "Unknown error"}`,
						description: "Generating video",
					};
				}

				const jobData = await response.json();
				return {
					success: true,
					result: `Video generation started via ${provider}. Job ID: ${(jobData as Record<string, string>).job_id}. This may take 1-2 minutes. Use poll_job_status to check when it's ready, then import_generated_asset to add it to the timeline.`,
					description: `Generating video: "${prompt.slice(0, 40)}..."`,
				};
			}

			// ── Video-to-Video Transformation ──
			case "transform_video": {
				const videoUrl = args.videoUrl as string;
				const prompt = args.prompt as string;
				const strength = (args.strength as number) ?? 0.7;

				const response = await apiFetch("/api/ai/video/video-to-video", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						video_url: videoUrl,
						prompt,
						strength,
					}),
				});

				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					return {
						success: false,
						result: `Video transformation failed: ${(err as Record<string, string>).detail || "Unknown error"}`,
						description: "Transforming video",
					};
				}

				const jobData = await response.json();
				return {
					success: true,
					result: `Video transformation started. Job ID: ${(jobData as Record<string, string>).job_id}. Applying "${prompt}" style. Use poll_job_status to check when it's ready, then import_generated_asset to add it to the timeline.`,
					description: `Transforming video with "${prompt.slice(0, 30)}..." style`,
				};
			}

			// ── AI Speech Generation (ElevenLabs TTS) ──
			case "generate_speech": {
				const text = args.text as string;
				const voiceId = args.voiceId as string | undefined;

				const response = await apiFetch("/api/ai/voice/tts", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						text,
						voice_id: voiceId,
					}),
				});

				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					return {
						success: false,
						result: `Speech generation failed: ${(err as Record<string, string>).detail || "Unknown error"}`,
						description: "Generating speech",
					};
				}

				const jobData = await response.json();
				return {
					success: true,
					result: `Speech generation started via ElevenLabs. Job ID: ${(jobData as Record<string, string>).job_id}. Text: "${text.slice(0, 50)}..." Use poll_job_status to check when it's ready, then import_generated_asset with type "audio" to add it to the timeline.`,
					description: `Generating speech: "${text.slice(0, 30)}..."`,
				};
			}

			// ── AI Sound Effect Generation (ElevenLabs) ──
			case "generate_sound_effect": {
				const prompt = args.prompt as string;
				const durationSeconds = args.durationSeconds as number | undefined;

				const response = await apiFetch("/api/ai/voice/sfx", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						prompt,
						duration_seconds: durationSeconds,
					}),
				});

				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					return {
						success: false,
						result: `Sound effect generation failed: ${(err as Record<string, string>).detail || "Unknown error"}`,
						description: "Generating sound effect",
					};
				}

				const jobData = await response.json();
				return {
					success: true,
					result: `Sound effect generation started. Job ID: ${(jobData as Record<string, string>).job_id}. Effect: "${prompt}". Use poll_job_status to check when it's ready, then import_generated_asset with type "audio" to add it to the timeline.`,
					description: `Generating SFX: "${prompt.slice(0, 30)}..."`,
				};
			}

			// ── Job Polling ──
			case "poll_job_status": {
				const jobId = args.jobId as string;
				const response = await apiFetch(`/api/ai/video/status/${jobId}`);

				if (!response.ok) {
					return {
						success: false,
						result: `Failed to poll job ${jobId}: ${response.statusText}`,
						description: "Polling job status",
					};
				}

				const statusData = (await response.json()) as Record<string, unknown>;
				const status = statusData.status as string;
				const progress = (statusData.progress as number) ?? 0;
				const resultUrl = statusData.result_url as string | undefined;

				if (status === "completed" && resultUrl) {
					return {
						success: true,
						result: `Job ${jobId} completed! Result URL: ${resultUrl}. Use import_generated_asset to add it to the timeline.`,
						description: "Job completed",
					};
				}

				if (status === "failed") {
					return {
						success: false,
						result: `Job ${jobId} failed: ${(statusData.error as string) || "Unknown error"}`,
						description: "Job failed",
					};
				}

				return {
					success: true,
					result: `Job ${jobId} is ${status} (${Math.round(progress * 100)}% complete). Poll again in a few seconds.`,
					description: `Job ${status}`,
				};
			}

			// ── Import Generated Asset ──
			case "import_generated_asset": {
				const assetUrl = args.url as string;
				const assetType = args.type as string;
				const startTime = (args.startTime as number) ?? 0;
				const duration = (args.duration as number) ?? 5;
				const name = (args.name as string) ?? "Generated asset";

				if (assetType === "audio") {
					const response = await fetch(assetUrl);
					if (!response.ok) {
						return {
							success: false,
							result: `Failed to download audio: ${response.statusText}`,
							description: "Importing audio asset",
						};
					}

					const arrayBuffer = await response.arrayBuffer();
					const audioContext = new AudioContext();
					const buffer = await audioContext.decodeAudioData(arrayBuffer);

					const tracks = editor.timeline.getTracks();
					const audioTrack = tracks.find((track) => track.type === "audio");
					const trackId = audioTrack
						? audioTrack.id
						: editor.timeline.addTrack({ type: "audio" });

					const element = buildLibraryAudioElement({
						sourceUrl: assetUrl,
						name,
						duration: buffer.duration,
						startTime,
						buffer,
					});

					editor.timeline.insertElement({
						placement: { mode: "explicit", trackId },
						element,
					});

					return {
						success: true,
						result: `Audio "${name}" added to timeline at ${startTime}s (duration: ${buffer.duration.toFixed(1)}s).`,
						description: `Imported audio: ${name}`,
					};
				}

				// Video or image — download and add to media track
				const projectId = editor.project.getActive()?.metadata.id;
				if (!projectId) {
					return {
						success: false,
						result: "No active project",
						description: `Importing ${assetType} asset`,
					};
				}

				const response = await fetch(assetUrl);
				if (!response.ok) {
					return {
						success: false,
						result: `Failed to download ${assetType}: ${response.statusText}`,
						description: `Importing ${assetType} asset`,
					};
				}

				const blob = await response.blob();
				const file = new File(
					[blob],
					`${name}.${assetType === "video" ? "mp4" : "png"}`,
					{
						type: assetType === "video" ? "video/mp4" : "image/png",
					},
				);

				const assetsBefore = editor.media.getAssets().length;
				await editor.media.addMediaAsset({
					projectId,
					asset: { file, name, type: assetType === "video" ? "video" : "image" },
				});
				const assetsAfter = editor.media.getAssets();
				const newAsset = assetsAfter[assetsAfter.length - 1];

				if (!newAsset || assetsAfter.length <= assetsBefore) {
					return {
						success: false,
						result: `Failed to add ${assetType} asset`,
						description: `Importing ${assetType} asset`,
					};
				}

				const tracks = editor.timeline.getTracks();
				const videoTrack = tracks.find((track) => track.type === "video");
				const trackId = videoTrack
					? videoTrack.id
					: editor.timeline.addTrack({ type: "video" });

				editor.timeline.insertElement({
					placement: { mode: "explicit", trackId },
					element: {
						type: assetType === "video" ? "video" : "image",
						mediaId: newAsset.id,
						startTime,
						duration:
							assetType === "video" ? (newAsset.duration ?? duration) : duration,
						name,
						trimStart: 0,
						trimEnd: 0,
						transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
						opacity: 1,
					},
				});

				return {
					success: true,
					result: `${assetType === "video" ? "Video" : "Image"} "${name}" added to timeline at ${startTime}s.`,
					description: `Imported ${assetType}: ${name}`,
				};
			}

			// ── List Available Voices ──
			case "list_voices": {
				const response = await apiFetch("/api/ai/voice/voices");

				if (!response.ok) {
					return {
						success: false,
						result:
							"Failed to list voices. ElevenLabs API key may not be configured.",
						description: "Listing available voices",
					};
				}

				const voiceData = await response.json();
				return {
					success: true,
					result: JSON.stringify(voiceData, null, 2),
					description: "Listing ElevenLabs voices",
				};
			}

			// ── Media Understanding ──
			case "understand_media": {
				const mediaUrl = args.mediaUrl as string;
				const mediaType = args.mediaType as string;
				const question = args.question as string | undefined;

				const response = await apiFetch("/api/ai/video/understand-media", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						media_url: mediaUrl,
						media_type: mediaType,
						question,
					}),
				});

				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					return {
						success: false,
						result: `Media analysis failed: ${(err as Record<string, string>).detail || "Unknown error"}`,
						description: "Analyzing media",
					};
				}

				const jobData = await response.json();
				return {
					success: true,
					result: `Media analysis started. Job ID: ${(jobData as Record<string, string>).job_id}. Analyzing ${mediaType} content.`,
					description: `Analyzing ${mediaType}`,
				};
			}

			// ── Stock Music Search ──
			case "search_stock_music": {
				const query = args.query as string;
				const params = new URLSearchParams({ query, type: "music" });

				const response = await apiFetch(
					`/api/sounds/search?${params.toString()}`,
				);
				if (!response.ok) {
					return {
						success: false,
						result: "Stock music search failed",
						description: "Searching for stock music",
					};
				}

				const results = await response.json();
				return {
					success: true,
					result: JSON.stringify(results, null, 2),
					description: `Searching for "${query}" stock music`,
				};
			}

			// ── Visual Feedback Loop ──
			case "sample_timeline_frames": {
				const count = Math.min((args.count as number) ?? 4, 8);
				const project = editor.project.getActive();
				const scene = editor.scenes.hasActiveScene()
					? editor.scenes.getActiveScene()
					: null;

				if (!scene || !project) {
					return {
						success: false,
						result: "No active scene or project",
						description: "Sampling timeline frames",
					};
				}

				let maxDuration = 0;
				for (const track of scene.tracks) {
					for (const el of track.elements) {
						const end = el.startTime + el.duration;
						if (end > maxDuration) maxDuration = end;
					}
				}

				if (maxDuration === 0) {
					return {
						success: false,
						result: "Timeline is empty, no frames to sample",
						description: "Sampling timeline frames",
					};
				}

				const sampleStart = (args.startTime as number) ?? 0;
				const sampleEnd = (args.endTime as number) ?? maxDuration;
				const sampleInterval =
					count > 1 ? (sampleEnd - sampleStart) / (count - 1) : 0;

				// Sample what's visible at each time point
				const frameSamples: Array<{
					time: number;
					visibleElements: Array<{
						name: string;
						type: string;
						content?: string;
					}>;
				}> = [];

				for (let i = 0; i < count; i++) {
					const time = sampleStart + sampleInterval * i;
					const visibleElements: Array<{
						name: string;
						type: string;
						content?: string;
					}> = [];

					for (const track of scene.tracks) {
						for (const el of track.elements) {
							if (time >= el.startTime && time < el.startTime + el.duration) {
								const entry: {
									name: string;
									type: string;
									content?: string;
								} = { name: el.name, type: el.type };
								if (el.type === "text") {
									entry.content = el.content;
								}
								visibleElements.push(entry);
							}
						}
					}

					frameSamples.push({
						time: Math.round(time * 100) / 100,
						visibleElements,
					});
				}

				return {
					success: true,
					result: JSON.stringify(
						{
							frameCount: frameSamples.length,
							canvasSize: `${project.settings.canvasSize.width}x${project.settings.canvasSize.height}`,
							frames: frameSamples,
						},
						null,
						2,
					),
					description: `Sampled ${frameSamples.length} frames from timeline`,
				};
			}

			case "review_composition": {
				const goal = args.goal as string;
				const project = editor.project.getActive();
				const scene = editor.scenes.hasActiveScene()
					? editor.scenes.getActiveScene()
					: null;

				if (!scene || !project) {
					return {
						success: false,
						result: "No active scene or project",
						description: "Reviewing composition",
					};
				}

				let maxDuration = 0;
				for (const track of scene.tracks) {
					for (const el of track.elements) {
						const end = el.startTime + el.duration;
						if (end > maxDuration) maxDuration = end;
					}
				}

				if (maxDuration === 0) {
					return {
						success: true,
						result: JSON.stringify({
							approved: false,
							issues: ["Timeline is empty"],
							suggestion: "Add content before reviewing",
						}),
						description: "Reviewing composition",
					};
				}

				// Build review context from timeline state
				const ctx = serializeEditorContext(editor);
				const trackSummary = ctx.tracks
					.map(
						(t) => `${t.name} (${t.type}): ${t.elements?.length ?? 0} elements`,
					)
					.join(", ");

				const reviewResult = {
					approved: true,
					goal,
					canvasSize: `${ctx.canvas.width}x${ctx.canvas.height}`,
					duration: maxDuration,
					trackSummary,
					issues: [] as string[],
					suggestions: [] as string[],
				};

				// Basic automated checks
				for (const track of ctx.tracks) {
					if (!track.elements) continue;
					for (const el of track.elements) {
						if (el.type === "text" && el.duration < 1) {
							reviewResult.issues.push(
								`Text "${el.content?.slice(0, 20)}" at ${el.startTime}s has very short duration (${el.duration}s)`,
							);
							reviewResult.approved = false;
						}
						if (el.startTime < 0) {
							reviewResult.issues.push(
								`Element "${el.name}" has negative start time`,
							);
							reviewResult.approved = false;
						}
					}
				}

				if (reviewResult.issues.length === 0) {
					reviewResult.suggestions.push(
						"Composition looks good based on timeline analysis",
					);
				}

				return {
					success: true,
					result: JSON.stringify(reviewResult, null, 2),
					description: `Composition review: ${reviewResult.approved ? "approved" : `${reviewResult.issues.length} issue(s) found`}`,
				};
			}

			// ── Autonomous Agent Pipeline ──
			case "start_agent_session": {
				const query = args.query as string;
				let context = (args.context as Record<string, unknown>) ?? {};
				const mediaAssetIds = (args.mediaAssetIds as string[]) ?? [];

				const project = editor.project.getActive();
				const projectId = project?.metadata.id;

				if (project) {
					context = {
						...context,
						canvas_width: project.settings.canvasSize?.width ?? 1920,
						canvas_height: project.settings.canvasSize?.height ?? 1080,
						fps: project.settings.fps ?? 30,
						requested_duration: project.metadata.duration ?? 60,
					};
				}

				const response = await apiFetch(
					`/api/agent/execute/${projectId || "default"}`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							query,
							context,
							media_asset_ids: mediaAssetIds,
						}),
					},
				);

				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					return {
						success: false,
						result: `Agent session failed to start: ${(err as Record<string, string>).detail || "Unknown error"}`,
						description: "Starting agent session",
					};
				}

				const data = await response.json();
				return {
					success: true,
					result: `🎬 Agent session started! Session ID: ${(data as Record<string, string>).session_id}. The AI is now planning your video. Use get_agent_status to check progress, or wait for clarifying questions.`,
					description: "Starting autonomous video creation",
				};
			}

			case "answer_agent_question": {
				const sessionId = args.sessionId as string;
				const questionId = args.questionId as string;
				const value = args.value as string;

				const response = await apiFetch(`/api/agent/answer/${sessionId}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						question_id: questionId,
						value,
					}),
				});

				if (!response.ok) {
					return {
						success: false,
						result: "Failed to submit answer",
						description: "Submitting Q&A answer",
					};
				}

				return {
					success: true,
					result: `Answer submitted for question ${questionId}. The agent will continue processing.`,
					description: "Answering agent question",
				};
			}

			case "get_agent_status": {
				const sessionId = args.sessionId as string;

				const response = await apiFetch(`/api/agent/status/${sessionId}`);

				if (!response.ok) {
					return {
						success: false,
						result: "Failed to get agent status. Session may have expired.",
						description: "Checking agent status",
					};
				}

				const statusData = (await response.json()) as Record<string, unknown>;

				// When completed, offer to hydrate the timeline
				if (
					statusData.status === "completed" &&
					statusData.assembled_timeline
				) {
					const timeline = statusData.assembled_timeline as Record<
						string,
						unknown
					>;
					const tracks = timeline.tracks as
						| Record<string, Array<Record<string, unknown>>>
						| undefined;

					if (tracks) {
						let totalElements = 0;
						for (const trackType of Object.keys(tracks)) {
							totalElements += (tracks[trackType] || []).length;
						}
						(statusData as Record<string, unknown>).timeline_summary = {
							total_duration: timeline.total_duration,
							fps: timeline.fps,
							resolution: timeline.resolution,
							total_elements: totalElements,
							track_types: Object.keys(tracks),
						};
						(statusData as Record<string, unknown>).next_step =
							"Use import_agent_timeline with this sessionId to load the timeline into the editor.";
					}
				}

				return {
					success: true,
					result: JSON.stringify(statusData, null, 2),
					description: `Agent status: ${statusData.status as string}`,
				};
			}

			case "import_agent_timeline": {
				const importResult = await importAgentTimeline(
					args.sessionId as string,
				);

				if (!importResult.success) {
					return {
						success: false,
						result: importResult.errors.join("; ") || "Import failed",
						description: "Importing agent timeline",
					};
				}

				const summary = `Imported ${importResult.videosAdded} video/image clips, ${importResult.audiosAdded} audio clips, ${importResult.textsAdded} text overlays.`;
				const errorSummary =
					importResult.errors.length > 0
						? ` ${importResult.errors.length} errors: ${importResult.errors.slice(0, 3).join("; ")}`
						: "";

				return {
					success: true,
					result: `${summary}${errorSummary}`,
					description: "Importing agent timeline into editor",
				};
			}

			case "ai_edit": {
				const orchestrator = new AiEditingOrchestrator();
				const editResult = await orchestrator.execute(
					args.prompt as string,
					editor,
				);

				if (!editResult.success) {
					return {
						success: false,
						result: `AI edit failed: ${editResult.error ?? "Unknown error"}`,
						description: "Executing AI-driven edit",
					};
				}

				const session = editResult.session;
				const commandCount = session?.commands?.length ?? 0;
				const planActionCount = session?.plan?.actions?.length ?? 0;

				return {
					success: true,
					result: JSON.stringify({
						sessionId: session?.id,
						status: session?.status,
						intent: session?.intent?.type,
						confidence: session?.intent?.confidence,
						planActions: planActionCount,
						commandsExecuted: commandCount,
						validation: editResult.validation,
						message: `Executed ${commandCount} commands for "${session?.intent?.type}" intent. Session ID: ${session?.id}. Use ai_edit_rollback to undo.`,
					}),
					description: "Executing AI-driven edit",
				};
			}

			case "ai_edit_analyze": {
				const orchestrator = new AiEditingOrchestrator();
				const metrics = orchestrator.analyzeCurrentTimeline(editor);

				return {
					success: true,
					result: JSON.stringify(metrics, null, 2),
					description: "Analyzing timeline for AI editing",
				};
			}

			case "ai_edit_rollback": {
				const orchestrator = new AiEditingOrchestrator();
				const rollbackResult = orchestrator.rollback(
					args.sessionId as string,
					editor,
				);

				return {
					success: rollbackResult,
					result: rollbackResult
						? `Successfully rolled back session ${args.sessionId}`
						: `Failed to rollback session ${args.sessionId}. Session may not exist or was already rolled back.`,
					description: "Rolling back AI edit session",
				};
			}

			case "ai_edit_get_sessions": {
				const orchestrator = new AiEditingOrchestrator();
				const sessions = orchestrator.getAllSessions();

				const summaries = sessions.map((session) => ({
					id: session.id,
					status: session.status,
					intent: session.intent?.type,
					confidence: session.intent?.confidence,
					commandCount: session.commands?.length ?? 0,
					createdAt: session.createdAt,
				}));

				return {
					success: true,
					result: JSON.stringify(summaries, null, 2),
					description: "Listing AI edit sessions",
				};
			}

			case "ai_edit_get_style_profiles": {
				const profileSummary = getStyleProfileSummary();

				return {
					success: true,
					result: JSON.stringify(profileSummary, null, 2),
					description: "Listing available style profiles",
				};
			}

			default:
				return {
					success: false,
					result: `Unknown tool: ${toolCall.name}`,
					description: `Unknown tool: ${toolCall.name}`,
				};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			result: `Tool execution error: ${message}`,
			description: `Error executing ${toolCall.name}`,
		};
	}
}
