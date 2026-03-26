import { EditorCore } from "@/core";
import { FONT_SIZE_SCALE_REFERENCE } from "@/constants/text-constants";
import { apiFetch } from "@/lib/api-client";
import { buildTextElement } from "@/lib/timeline/element-utils";

export interface TimelineImportResult {
	success: boolean;
	videosAdded: number;
	audiosAdded: number;
	textsAdded: number;
	errors: string[];
}

/**
 * Imports a completed agent pipeline timeline into the editor.
 * Downloads all generated assets and inserts them as timeline elements.
 */
export async function importAgentTimeline(
	sessionId: string,
): Promise<TimelineImportResult> {
	const editor = EditorCore.getInstance();

	const response = await apiFetch(`/api/agent/status/${sessionId}`);
	if (!response.ok) {
		return {
			success: false,
			videosAdded: 0,
			audiosAdded: 0,
			textsAdded: 0,
			errors: ["Failed to fetch agent session"],
		};
	}

	const statusData = (await response.json()) as Record<string, unknown>;
	if (statusData.status !== "completed" || !statusData.assembled_timeline) {
		return {
			success: false,
			videosAdded: 0,
			audiosAdded: 0,
			textsAdded: 0,
			errors: [
				`Agent session is not completed (status: ${statusData.status as string})`,
			],
		};
	}

	const timeline = statusData.assembled_timeline as Record<string, unknown>;
	const tracks = timeline.tracks as
		| Record<string, Array<Record<string, unknown>>>
		| undefined;
	if (!tracks) {
		return {
			success: false,
			videosAdded: 0,
			audiosAdded: 0,
			textsAdded: 0,
			errors: ["No tracks found in assembled timeline"],
		};
	}

	const projectId = editor.project.getActive()?.metadata.id;
	if (!projectId) {
		return {
			success: false,
			videosAdded: 0,
			audiosAdded: 0,
			textsAdded: 0,
			errors: ["No active project"],
		};
	}

	let videosAdded = 0;
	let audiosAdded = 0;
	let textsAdded = 0;
	const errors: string[] = [];

	const downloadAndAddAsset = async (
		assetUrl: string,
		name: string,
		mediaType: "video" | "audio" | "image",
	): Promise<string | null> => {
		if (!assetUrl || !assetUrl.startsWith("http")) return null;
		try {
			const assetResp = await fetch(assetUrl);
			if (!assetResp.ok) return null;
			const blob = await assetResp.blob();
			const ext =
				mediaType === "video"
					? "mp4"
					: mediaType === "audio"
						? "mp3"
						: "jpg";
			const mime =
				mediaType === "video"
					? "video/mp4"
					: mediaType === "audio"
						? "audio/mpeg"
						: "image/jpeg";
			const file = new File([blob], `${name}.${ext}`, { type: mime });

			const assetsBefore = editor.media.getAssets().length;
			await editor.media.addMediaAsset({
				projectId,
				asset: { file, name, type: mediaType === "image" ? "image" : mediaType },
			});
			const assetsAfter = editor.media.getAssets();
			if (assetsAfter.length > assetsBefore) {
				const newAsset = assetsAfter.at(-1);
				return newAsset?.id ?? null;
			}
		} catch (error) {
			errors.push(
				`Failed to download ${name}: ${error instanceof Error ? error.message : "unknown"}`,
			);
		}
		return null;
	};

	// Import video track clips
	const videoClips = tracks.video || [];
	for (const clip of videoClips) {
		const assetUrl = (clip.assetUrl as string) || "";
		const clipType = (clip.type as string) || "video";
		const clipName = (clip.id as string) || `clip-${videosAdded}`;

		if (!assetUrl || assetUrl === "deferred_motion_graphic") continue;

		const mediaType =
			clipType === "image" ? ("image" as const) : ("video" as const);
		const mediaId = await downloadAndAddAsset(assetUrl, clipName, mediaType);
		if (!mediaId) continue;

		if (mediaType === "video") {
			editor.timeline.insertElement({
				element: {
					type: "video",
					mediaId,
					name: clipName,
					duration: (clip.duration as number) || 5,
					startTime: (clip.startTime as number) || 0,
					trimStart: (clip.trimStart as number) || 0,
					trimEnd: (clip.trimEnd as number) || 0,
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
					mediaId,
					name: clipName,
					duration: (clip.duration as number) || 5,
					startTime: (clip.startTime as number) || 0,
					trimStart: 0,
					trimEnd: 0,
					hidden: false,
					transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
					opacity: 1,
				},
				placement: { mode: "auto" },
			});
		}
		videosAdded++;
	}

	// Import audio tracks (voiceover, ambient, SFX)
	const audioClips = [...(tracks.audio || []), ...(tracks.effects || [])];
	for (const clip of audioClips) {
		const assetUrl = (clip.assetUrl as string) || "";
		if (!assetUrl || !assetUrl.startsWith("http")) continue;

		const clipName = (clip.id as string) || `audio-${audiosAdded}`;
		const mediaId = await downloadAndAddAsset(assetUrl, clipName, "audio");
		if (!mediaId) continue;

		editor.timeline.insertElement({
			element: {
				type: "audio",
				sourceType: "upload",
				mediaId,
				name: clipName,
				duration: (clip.duration as number) || 5,
				startTime: (clip.startTime as number) || 0,
				trimStart: 0,
				trimEnd: 0,
				volume: (clip.volume as number) ?? 1,
				muted: false,
			},
			placement: { mode: "auto" },
		});
		audiosAdded++;
	}

	// Import music track
	const musicClips = tracks.music || [];
	for (const clip of musicClips) {
		const assetUrl = (clip.assetUrl as string) || "";
		if (!assetUrl || !assetUrl.startsWith("http")) continue;

		const clipName = (clip.id as string) || `music-${audiosAdded}`;
		const mediaId = await downloadAndAddAsset(assetUrl, clipName, "audio");
		if (!mediaId) continue;

		editor.timeline.insertElement({
			element: {
				type: "audio",
				sourceType: "upload",
				mediaId,
				name: clipName,
				duration: (clip.duration as number) || 30,
				startTime: (clip.startTime as number) || 0,
				trimStart: 0,
				trimEnd: 0,
				volume: (clip.volume as number) ?? 0.3,
				muted: false,
			},
			placement: { mode: "auto" },
		});
		audiosAdded++;
	}

	// Import text overlays
	const textClips = [...(tracks.text || []), ...(tracks.captions || [])];
	const textItems: Array<{
		element: ReturnType<typeof buildTextElement>;
		placement: { mode: "auto" };
	}> = [];

	const resolution = timeline.resolution as
		| { width?: number; height?: number }
		| undefined;
	const timelineCanvasHeight =
		resolution?.height ??
		editor.project.getActive()?.settings.canvasSize?.height ??
		1080;
	const pixelToRelative = FONT_SIZE_SCALE_REFERENCE / timelineCanvasHeight;

	for (const clip of textClips) {
		const content =
			(clip.content as string) || (clip.text as string) || "";
		if (!content) continue;

		const rawFontSize = (clip.fontSize as number) || 48;
		const relativeFontSize =
			Math.round(rawFontSize * pixelToRelative * 10) / 10;

		const rawPaddingX = clip.paddingX as number | undefined;
		const rawPaddingY = clip.paddingY as number | undefined;

		const element = buildTextElement({
			raw: {
				name: content.slice(0, 30),
				content,
				duration: (clip.duration as number) || 3,
				fontSize: relativeFontSize,
				fontFamily:
					(clip.font as string) || (clip.fontFamily as string) || "Inter",
				color: (clip.color as string) || "#ffffff",
				fontWeight: (clip.fontWeight as "normal" | "bold") || "bold",
				background: {
					color: (clip.backgroundColor as string) || "#00000000",
					paddingX: rawPaddingX,
					paddingY: rawPaddingY,
				},
				textAlign: "center",
				lineHeight: clip.lineHeight as number | undefined,
				transform: {
					scale: 1,
					position: { x: 0, y: 0.35 },
					rotate: 0,
				},
			},
			startTime: (clip.startTime as number) || 0,
		});

		textItems.push({ element, placement: { mode: "auto" } });
		textsAdded++;
	}

	if (textItems.length > 0) {
		editor.timeline.insertElements(textItems);
	}

	return {
		success: true,
		videosAdded,
		audiosAdded,
		textsAdded,
		errors,
	};
}
