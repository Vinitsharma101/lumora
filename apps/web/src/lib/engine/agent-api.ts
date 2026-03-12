/**
 * Agent Timeline API — the command interface for AI agents.
 *
 * Agents never manipulate raw arrays. They call typed, validated
 * commands through this API. Every call is recorded in the event log
 * and produces an undo-able command through the existing CommandManager.
 *
 * Usage:
 *   const api = new AgentTimelineAPI(editorCore);
 *   api.cut("clip-1", 5.0);
 *   api.trim("clip-1", { inPoint: 0.5, outPoint: 10.0 });
 *   api.insertBRoll("nature", 12.0);
 */

import type { EditorCore } from "@/core";
import type {
	TrackType,
	TimelineTrack,
	TimelineElement,
	CreateTimelineElement,
} from "@/types/timeline";
import type { PacingMetrics, PacingSuggestion } from "./pacing";
import type { TimelineEngine } from "./timeline-engine";

export interface AgentEditResult {
	success: boolean;
	elementIds?: string[];
	error?: string;
}

export class AgentTimelineAPI {
	constructor(
		private editor: EditorCore,
		private engine: TimelineEngine,
	) {}

	// ── Clip operations ───────────────────────────────────────────

	/**
	 * Cut (split) a clip at the given timeline time.
	 * Returns the IDs of the two resulting clips.
	 */
	cut(clipId: string, atTime: number): AgentEditResult {
		const location = this.findElement(clipId);
		if (!location) {
			return { success: false, error: `Clip ${clipId} not found` };
		}

		const { trackId, element } = location;
		const clipEnd = element.startTime + element.duration;

		if (atTime <= element.startTime || atTime >= clipEnd) {
			return {
				success: false,
				error: `Time ${atTime} is outside clip bounds [${element.startTime}, ${clipEnd})`,
			};
		}

		const rightSide = this.editor.timeline.splitElements({
			elements: [{ trackId, elementId: clipId }],
			splitTime: atTime,
		});

		this.engine.recordEvent(
			"SPLIT_ELEMENT",
			{ clipId, atTime, trackId },
			"agent",
		);

		return {
			success: true,
			elementIds: [clipId, ...rightSide.map((r) => r.elementId)],
		};
	}

	/**
	 * Trim a clip's in/out points (non-destructive source trim).
	 */
	trim(
		clipId: string,
		{ inPoint, outPoint }: { inPoint?: number; outPoint?: number },
	): AgentEditResult {
		const location = this.findElement(clipId);
		if (!location) {
			return { success: false, error: `Clip ${clipId} not found` };
		}

		const trimStart = inPoint ?? location.element.trimStart;
		const trimEnd = outPoint ?? location.element.trimEnd;

		this.editor.timeline.updateElementTrim({
			elementId: clipId,
			trimStart,
			trimEnd,
		});

		this.engine.recordEvent(
			"TRIM_ELEMENT",
			{ clipId, trimStart, trimEnd },
			"agent",
		);

		return { success: true, elementIds: [clipId] };
	}

	/**
	 * Insert a new clip on the timeline.
	 */
	insertClip(
		element: CreateTimelineElement,
		options?: {
			trackId?: string;
			trackType?: TrackType;
		},
	): AgentEditResult {
		const placement = options?.trackId
			? ({ mode: "explicit", trackId: options.trackId } as const)
			: ({ mode: "auto", trackType: options?.trackType } as const);

		this.editor.timeline.insertElement({ element, placement });

		this.engine.recordEvent(
			"INSERT_ELEMENT",
			{ element, placement },
			"agent",
		);

		return { success: true };
	}

	/**
	 * Delete one or more clips.
	 */
	deleteClips(clipIds: string[]): AgentEditResult {
		const elements = clipIds
			.map((id) => this.findElement(id))
			.filter(Boolean) as Array<{
			trackId: string;
			element: TimelineElement;
		}>;

		if (elements.length === 0) {
			return { success: false, error: "No matching clips found" };
		}

		this.editor.timeline.deleteElements({
			elements: elements.map((e) => ({
				trackId: e.trackId,
				elementId: e.element.id,
			})),
		});

		this.engine.recordEvent(
			"DELETE_ELEMENTS",
			{ clipIds },
			"agent",
		);

		return { success: true, elementIds: clipIds };
	}

	/**
	 * Move a clip to a new start time (and optionally a new track).
	 */
	moveClip(
		clipId: string,
		newStartTime: number,
		targetTrackId?: string,
	): AgentEditResult {
		const location = this.findElement(clipId);
		if (!location) {
			return { success: false, error: `Clip ${clipId} not found` };
		}

		this.editor.timeline.moveElement({
			sourceTrackId: location.trackId,
			targetTrackId: targetTrackId ?? location.trackId,
			elementId: clipId,
			newStartTime,
		});

		this.engine.recordEvent(
			"MOVE_ELEMENT",
			{ clipId, newStartTime, targetTrackId },
			"agent",
		);

		return { success: true, elementIds: [clipId] };
	}

	/**
	 * Update arbitrary properties on a clip.
	 */
	updateClip(
		clipId: string,
		updates: Partial<Record<string, unknown>>,
	): AgentEditResult {
		const location = this.findElement(clipId);
		if (!location) {
			return { success: false, error: `Clip ${clipId} not found` };
		}

		this.editor.timeline.updateElements({
			updates: [
				{
					trackId: location.trackId,
					elementId: clipId,
					updates,
				},
			],
		});

		this.engine.recordEvent(
			"UPDATE_ELEMENT",
			{ clipId, updates },
			"agent",
		);

		return { success: true, elementIds: [clipId] };
	}

	/**
	 * Duplicate clips.
	 */
	duplicateClips(clipIds: string[]): AgentEditResult {
		const elements = clipIds
			.map((id) => this.findElement(id))
			.filter(Boolean) as Array<{
			trackId: string;
			element: TimelineElement;
		}>;

		if (elements.length === 0) {
			return { success: false, error: "No matching clips found" };
		}

		const result = this.editor.timeline.duplicateElements({
			elements: elements.map((e) => ({
				trackId: e.trackId,
				elementId: e.element.id,
			})),
		});

		this.engine.recordEvent(
			"DUPLICATE_ELEMENTS",
			{ clipIds },
			"agent",
		);

		return {
			success: true,
			elementIds: result.map((r) => r.elementId),
		};
	}

	// ── Track operations ──────────────────────────────────────────

	/**
	 * Add a new track.
	 */
	addTrack(type: TrackType, index?: number): AgentEditResult {
		const trackId = this.editor.timeline.addTrack({ type, index });

		this.engine.recordEvent(
			"ADD_TRACK",
			{ type, index, trackId },
			"agent",
		);

		return { success: true, elementIds: [trackId] };
	}

	/**
	 * Remove a track.
	 */
	removeTrack(trackId: string): AgentEditResult {
		this.editor.timeline.removeTrack({ trackId });

		this.engine.recordEvent(
			"REMOVE_TRACK",
			{ trackId },
			"agent",
		);

		return { success: true };
	}

	// ── Pacing ────────────────────────────────────────────────────

	/**
	 * Analyse the pacing of the current edit.
	 */
	analyzePacing(): PacingMetrics {
		const totalDuration = this.editor.timeline.getTotalDuration();
		return this.engine.analyzePacing(totalDuration);
	}

	/**
	 * Get AI pacing suggestions.
	 */
	getPacingSuggestions(threshold?: number): PacingSuggestion[] {
		const totalDuration = this.editor.timeline.getTotalDuration();
		return this.engine.suggestPacing(totalDuration, threshold);
	}

	/**
	 * Auto-pace: apply pacing suggestions automatically.
	 */
	autoPace(threshold = 40): AgentEditResult {
		const suggestions = this.getPacingSuggestions(threshold);

		// Apply trim suggestions
		for (const suggestion of suggestions) {
			if (suggestion.type === "trim") {
				// Find clip at this position and trim it
				const resolved = this.engine
					.getResolver()
					.resolveAt(suggestion.startTime);
				for (const clip of resolved) {
					if (clip.element.duration > 3) {
						this.trim(clip.element.id, {
							outPoint:
								clip.element.trimEnd +
								clip.element.duration * 0.2,
						});
					}
				}
			}
		}

		return { success: true };
	}

	// ── Queries ───────────────────────────────────────────────────

	/**
	 * List all tracks.
	 */
	listTracks(): TimelineTrack[] {
		return this.editor.timeline.getTracks();
	}

	/**
	 * Get all clips on a track.
	 */
	getTrackClips(trackId: string): TimelineElement[] {
		const track = this.editor.timeline.getTrackById({ trackId });
		return track?.elements ?? [];
	}

	/**
	 * Find which clips are active at a given time.
	 */
	getActiveClipsAt(time: number) {
		return this.engine.getResolver().resolveAt(time);
	}

	/**
	 * Get the total timeline duration.
	 */
	getTotalDuration(): number {
		return this.editor.timeline.getTotalDuration();
	}

	/**
	 * Get timeline event history (for display or replay).
	 */
	getEditHistory(count?: number) {
		if (count) return this.engine.getEventLog().slice(-count);
		return this.engine.getEventLog();
	}

	// ── Internal helpers ──────────────────────────────────────────

	private findElement(
		elementId: string,
	): { trackId: string; element: TimelineElement } | null {
		for (const track of this.editor.timeline.getTracks()) {
			const element = track.elements.find((el) => el.id === elementId);
			if (element) {
				return { trackId: track.id, element };
			}
		}
		return null;
	}
}
