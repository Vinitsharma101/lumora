import type { EditorCore } from "@/core";
import type { TimelineTrack, TimelineElement } from "@/types/timeline";

/** Maximum number of individual elements sent in AI context before we summarize. */
const MAX_ELEMENTS_IN_CONTEXT = 50;

export interface EditorContext {
	canvas: {
		width: number;
		height: number;
		fps: number;
		background: string;
	};
	duration: number;
	currentTime: number;
	tracks: TrackSummary[];
	mediaAssets: MediaAssetSummary[];
	/** True when the element list was truncated to fit the token budget. */
	isTruncated?: boolean;
	/** Total element count across all tracks (when isTruncated is true). */
	totalElementCount?: number;
}

interface TrackSummary {
	id: string;
	name: string;
	type: string;
	/** Present when NOT truncated — full list of per-element summaries. */
	elements?: ElementSummary[];
	/** Present when IS truncated — compact one-liner per track. */
	elementSummary?: string;
}

interface ElementSummary {
	id: string;
	name: string;
	type: string;
	startTime: number;
	duration: number;
	content?: string;
}

interface MediaAssetSummary {
	id: string;
	name: string;
	type: string;
	duration?: number;
}

function summarizeElement(el: TimelineElement): ElementSummary {
	const summary: ElementSummary = {
		id: el.id,
		name: el.name,
		type: el.type,
		startTime: el.startTime,
		duration: el.duration,
	};

	if (el.type === "text") {
		summary.content = el.content;
	}

	return summary;
}

function summarizeTrackFull(track: TimelineTrack): TrackSummary {
	return {
		id: track.id,
		name: track.name,
		type: track.type,
		elements: track.elements.map(summarizeElement),
	};
}

function summarizeTrackCompact(track: TimelineTrack): TrackSummary {
	const count = track.elements.length;
	const minStart = count > 0 ? Math.min(...track.elements.map((e) => e.startTime)) : 0;
	const maxEnd =
		count > 0
			? Math.max(...track.elements.map((e) => e.startTime + e.duration))
			: 0;
	return {
		id: track.id,
		name: track.name,
		type: track.type,
		elementSummary: `${count} ${track.type} element(s) spanning ${minStart.toFixed(1)}s–${maxEnd.toFixed(1)}s`,
	};
}

export function serializeEditorContext(editor: EditorCore): EditorContext {
	const project = editor.project.getActive();
	const scene = editor.scenes.hasActiveScene()
		? editor.scenes.getActiveScene()
		: null;
	const tracks = scene?.tracks ?? [];
	const mediaAssets = editor.media.getAssets();

	const settings = project?.settings;
	const canvasWidth = settings?.canvasSize?.width ?? 1920;
	const canvasHeight = settings?.canvasSize?.height ?? 1080;
	const fps = settings?.fps ?? 30;
	const bg = settings?.background;
	const bgColor = bg?.type === "color" ? bg.color : "#000000";

	let maxDuration = 0;
	let totalElementCount = 0;
	for (const track of tracks) {
		totalElementCount += track.elements.length;
		for (const el of track.elements) {
			const end = el.startTime + el.duration;
			if (end > maxDuration) maxDuration = end;
		}
	}

	const isTruncated = totalElementCount > MAX_ELEMENTS_IN_CONTEXT;
	const trackSummaries: TrackSummary[] = isTruncated
		? tracks.map(summarizeTrackCompact)
		: tracks.map(summarizeTrackFull);

	return {
		canvas: {
			width: canvasWidth,
			height: canvasHeight,
			fps,
			background: bgColor,
		},
		duration: maxDuration,
		currentTime: editor.playback.getCurrentTime(),
		tracks: trackSummaries,
		mediaAssets: mediaAssets.map((a) => ({
			id: a.id,
			name: a.name,
			type: a.type,
			duration: a.duration,
		})),
		...(isTruncated && {
			isTruncated: true,
			totalElementCount,
		}),
	};
}
