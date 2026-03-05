import { EditorCore } from "@/core";
import { apiFetch } from "@/lib/api-client";
import { buildTextElement } from "@/lib/timeline/element-utils";
import { serializeEditorContext } from "../context";
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
		props: { primaryText: "string", secondaryText: "string", accentColor: "string" },
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
				const textAlign = (args.textAlign as "left" | "center" | "right") ?? "center";
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
							color: backgroundColor === "transparent" ? "#00000000" : backgroundColor,
						},
						textAlign,
						fontWeight,
						transform: { scale: 1, position: { x: positionX, y: positionY }, rotate: 0 },
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
				const sharedFontSize = (args.fontSize as number) ?? 14;
				const sharedColor = (args.color as string) ?? "#ffffff";
				const sharedBg = (args.backgroundColor as string) ?? "#000000";
				const sharedPosY = (args.positionY as number) ?? 0.35;

				for (const cap of captions) {
					const element = buildTextElement({
						raw: {
							name: cap.content.slice(0, 30),
							content: cap.content,
							duration: cap.duration,
							fontSize: sharedFontSize,
							color: sharedColor,
							background: {
								color: sharedBg === "transparent" ? "#00000000" : sharedBg,
							},
							textAlign: "center",
							transform: { scale: 1, position: { x: 0, y: sharedPosY }, rotate: 0 },
						},
						startTime: cap.startTime,
					});

					editor.timeline.insertElement({
						element,
						placement: { mode: "auto" },
					});
				}

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

				const response = await apiFetch("/api/ai/voice", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ text, voiceId }),
				});

				if (!response.ok) {
					const err = await response.json();
					return {
						success: false,
						result: `Voice generation failed: ${err.error || "Unknown error"}`,
						description: "Generating voiceover",
					};
				}

				const blob = await response.blob();
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
					const err = await response.json();
					return {
						success: false,
						result: `Music generation failed: ${err.error || "Unknown error"}`,
						description: "Generating music",
					};
				}

				const blob = await response.blob();
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

				const stockAssetsBefore = editor.media.getAssets().length;
				await editor.media.addMediaAsset({
					projectId,
					asset: { file, name, type: mediaType },
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

				// Call the Next.js API route (server-side Remotion rendering)
				const response = await fetch("/api/render-motion", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						compositionId,
						props,
						width: editor.project.getActive()?.settings.canvasSize?.width ?? 1920,
						height: editor.project.getActive()?.settings.canvasSize?.height ?? 1080,
						fps: editor.project.getActive()?.settings.fps ?? 30,
						durationInFrames: Math.round(duration * (editor.project.getActive()?.settings.fps ?? 30)),
					}),
				});

				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					return {
						success: false,
						result: `Motion graphic rendering failed: ${(err as Record<string, string>).error || "Unknown error"}`,
						description: "Rendering motion graphic",
					};
				}

				const blob = await response.blob();
				const file = new File([blob], `${compositionId}-${Date.now()}.mp4`, {
					type: "video/mp4",
				});

				const projectId = editor.project.getActive()?.metadata.id;
				if (!projectId) {
					return {
						success: false,
						result: "No active project",
						description: "Adding motion graphic",
					};
				}

				const motionAssetsBefore = editor.media.getAssets().length;
				await editor.media.addMediaAsset({
					projectId,
					asset: { file, name: `Motion: ${compositionId}`, type: "video" },
				});
				const motionAssetsAfter = editor.media.getAssets();
				const newMotionAsset = motionAssetsAfter[motionAssetsAfter.length - 1];

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
