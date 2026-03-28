import { Command } from "@/lib/commands/base-command";
import type { TimelineTrack } from "@/types/timeline";
import { EditorCore } from "@/core";
import { generateUUID } from "@/utils/id";
import { buildEmptyTrack } from "@/lib/timeline/track-utils";

/**
 * Extracts audio from a video element into a separate audio track below it.
 * The video element is muted, and a new audio element referencing the same
 * media asset is placed on the new audio track with matching timing.
 */
export class ExtractAudioCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private trackId: string,
		private elementId: string,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const trackIndex = this.savedState.findIndex(
			(t) => t.id === this.trackId,
		);
		const track = this.savedState[trackIndex];
		if (!track || trackIndex === -1) return;

		const element = track.elements.find((el) => el.id === this.elementId);
		if (!element || element.type !== "video") return;

		// Mute the video element
		const updatedVideoTrack = {
			...track,
			elements: track.elements.map((el) =>
				el.id === this.elementId ? { ...el, muted: true } : el,
			),
		} as TimelineTrack;

		// Create a new audio track
		const audioTrackId = generateUUID();
		const audioTrack = buildEmptyTrack({
			id: audioTrackId,
			type: "audio",
		});

		// Create an audio element referencing the same media
		const audioElement = {
			id: generateUUID(),
			type: "audio" as const,
			sourceType: "upload" as const,
			mediaId: element.mediaId,
			name: element.name,
			duration: element.duration,
			startTime: element.startTime,
			trimStart: element.trimStart,
			trimEnd: element.trimEnd,
			volume: 1,
			muted: false,
		};

		audioTrack.elements = [audioElement];

		// Insert audio track right below the video track
		const updatedTracks = [...this.savedState];
		updatedTracks[trackIndex] = updatedVideoTrack;
		updatedTracks.splice(trackIndex + 1, 0, audioTrack as TimelineTrack);

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
