import type { EditorCore } from "@/core";
import type { TimelineTrack, TimelineElement, TScene } from "@/types/timeline";

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
}

interface TrackSummary {
	id: string;
	name: string;
	type: string;
	elements: ElementSummary[];
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

function summarizeTrack(track: TimelineTrack): TrackSummary {
	return {
		id: track.id,
		name: track.name,
		type: track.type,
		elements: track.elements.map(summarizeElement),
	};
}

export function serializeEditorContext(editor: EditorCore): EditorContext {
	const project = editor.project.getActive();
	const scene = editor.scenes.getActiveScene();
	const tracks = scene?.tracks ?? [];
	const mediaAssets = editor.media.getAssets();

	const settings = project?.settings;
	const canvasWidth = settings?.canvasSize?.width ?? 1920;
	const canvasHeight = settings?.canvasSize?.height ?? 1080;
	const fps = settings?.fps ?? 30;
	const bg = settings?.background;
	const bgColor = bg?.type === "color" ? bg.color : "#000000";

	let maxDuration = 0;
	for (const track of tracks) {
		for (const el of track.elements) {
			const end = el.startTime + el.duration;
			if (end > maxDuration) maxDuration = end;
		}
	}

	return {
		canvas: {
			width: canvasWidth,
			height: canvasHeight,
			fps,
			background: bgColor,
		},
		duration: maxDuration,
		currentTime: editor.playback.getCurrentTime(),
		tracks: tracks.map(summarizeTrack),
		mediaAssets: mediaAssets.map((a) => ({
			id: a.id,
			name: a.name,
			type: a.type,
			duration: a.duration,
		})),
	};
}
