/**
 * TimelineEngine — the deterministic compositing graph.
 *
 * Sits above the existing TimelineManager and wraps all
 * runtime systems:
 *   - TimeResolver  (O(log n) clip query)
 *   - Keyframes     (property interpolation)
 *   - Pacing        (edit-rhythm analysis)
 *   - EventLog      (event-sourced history)
 *   - Snap          (magnetic / ripple)
 *
 * The engine is rebuilt whenever the timeline version changes
 * (i.e. whenever a command is executed). It is stateless between
 * rebuilds — all truth comes from the track array.
 */

import type {
	TimelineTrack,
	TimelineElement,
	Bookmark,
} from "@/types/timeline";
import { TimeResolver, type ResolvedClip } from "./time-resolver";
import {
	resolveKeyframesAt,
	interpolateKeyframes,
} from "./keyframes";
import {
	analyzePacing,
	suggestPacingFixes,
	type PacingMetrics,
	type PacingSuggestion,
} from "./pacing";
import { EventLog, type EditEvent, type EditEventType } from "./event-log";
import {
	collectSnapPoints,
	magneticSnap,
	rippleInsert,
	rippleDelete,
	closeGaps,
	type SnapConfig,
	type MagneticSnapResult,
	DEFAULT_SNAP_CONFIG,
} from "./snap";

// ── Resolved frame ────────────────────────────────────────────────

export interface ResolvedFrame {
	/** Timeline time this frame represents. */
	time: number;
	/** All active clips, bottom-to-top compositing order. */
	clips: ResolvedFrameClip[];
}

export interface ResolvedFrameClip extends ResolvedClip {
	/** Interpolated keyframe values for this clip at this time. */
	animatedValues: Map<string, number>;
}

// ── Engine ────────────────────────────────────────────────────────

export class TimelineEngine {
	private resolver: TimeResolver;
	private eventLog: EventLog;
	private cachedVersion: number;
	private tracks: TimelineTrack[];

	constructor(tracks: TimelineTrack[], version = 0) {
		this.tracks = tracks;
		this.cachedVersion = version;
		this.resolver = new TimeResolver(tracks, version);
		this.eventLog = new EventLog();
	}

	// ── Core resolution ───────────────────────────────────────────

	/**
	 * Resolve a single frame at `time`. Returns all active clips
	 * with their animated property values.
	 */
	resolveFrame(time: number): ResolvedFrame {
		const clips = this.resolver.resolveAt(time);

		const resolvedClips: ResolvedFrameClip[] = clips.map((clip) => {
			const element = clip.element;
			const localTime = time - element.startTime;
			const keyframes = element.keyframes ?? [];
			const animatedValues = resolveKeyframesAt(keyframes, localTime);

			return { ...clip, animatedValues };
		});

		return { time, clips: resolvedClips };
	}

	/**
	 * Resolve all frames within a range (for cache warming or export).
	 */
	resolveRange(
		startTime: number,
		endTime: number,
		fps: number,
	): ResolvedFrame[] {
		const frames: ResolvedFrame[] = [];
		const frameDuration = 1 / fps;

		let t = startTime;
		while (t < endTime) {
			frames.push(this.resolveFrame(t));
			t += frameDuration;
		}

		return frames;
	}

	/**
	 * Interpolate a single animated property on an element.
	 */
	interpolateProperty(
		elementId: string,
		property: string,
		time: number,
	): number | undefined {
		for (const track of this.tracks) {
			const element = track.elements.find((el) => el.id === elementId);
			if (element) {
				const localTime = time - element.startTime;
				return interpolateKeyframes(
					element.keyframes ?? [],
					property,
					localTime,
				);
			}
		}
		return undefined;
	}

	// ── Rebuild ───────────────────────────────────────────────────

	/**
	 * Rebuild internal indices from fresh tracks.
	 * Call this whenever the timeline mutates.
	 */
	rebuild(tracks: TimelineTrack[], version: number): void {
		if (version === this.cachedVersion) return;
		this.tracks = tracks;
		this.cachedVersion = version;
		this.resolver = new TimeResolver(tracks, version);
	}

	/**
	 * Check if a rebuild is needed. The caller can compare version
	 * numbers to decide when to rebuild.
	 */
	needsRebuild(currentVersion: number): boolean {
		return currentVersion !== this.cachedVersion;
	}

	// ── Pacing ────────────────────────────────────────────────────

	/**
	 * Analyse the pacing of the current timeline.
	 */
	analyzePacing(totalDuration: number): PacingMetrics {
		return analyzePacing({ tracks: this.tracks, totalDuration });
	}

	/**
	 * Get AI-driven pacing suggestions.
	 */
	suggestPacing(
		totalDuration: number,
		threshold?: number,
	): PacingSuggestion[] {
		return suggestPacingFixes({
			tracks: this.tracks,
			totalDuration,
			threshold,
		});
	}

	// ── Event log ─────────────────────────────────────────────────

	/**
	 * Record an edit event.
	 */
	recordEvent(
		type: EditEventType,
		payload: Record<string, unknown>,
		source?: string,
	): EditEvent {
		return this.eventLog.append({ type, payload, source });
	}

	/**
	 * Get the full event log.
	 */
	getEventLog(): readonly EditEvent[] {
		return this.eventLog.getEvents();
	}

	/**
	 * Get events since a checkpoint.
	 */
	getEventsSince(eventId: string): EditEvent[] {
		return this.eventLog.getEventsSince(eventId);
	}

	/**
	 * Export the event log as JSON.
	 */
	exportEventLog(): EditEvent[] {
		return this.eventLog.toJSON();
	}

	/**
	 * Import an event log (e.g. from a saved project).
	 */
	importEventLog(events: EditEvent[]): void {
		this.eventLog = EventLog.fromJSON(events);
	}

	/**
	 * Create a branch from a specific event.
	 */
	branchFromEvent(eventId: string): EditEvent[] {
		return this.eventLog.branchFrom(eventId);
	}

	// ── Snap helpers ──────────────────────────────────────────────

	/**
	 * Snap a time to the nearest magnetic point.
	 */
	snap({
		targetTime,
		playheadTime,
		config = DEFAULT_SNAP_CONFIG,
		excludeElementId,
		bookmarks = [],
		beatMarkers = [],
	}: {
		targetTime: number;
		playheadTime: number;
		config?: SnapConfig;
		excludeElementId?: string;
		bookmarks?: Bookmark[];
		beatMarkers?: number[];
	}): MagneticSnapResult {
		const points = collectSnapPoints({
			config,
			tracks: this.tracks,
			playheadTime,
			excludeElementId,
			bookmarks,
			beatMarkers,
		});
		return magneticSnap({ targetTime, points, config });
	}

	/**
	 * Ripple-insert a duration into a track's element array.
	 */
	rippleInsert(
		elements: TimelineElement[],
		insertTime: number,
		insertDuration: number,
	): TimelineElement[] {
		return rippleInsert({ elements, insertTime, insertDuration });
	}

	/**
	 * Ripple-delete: close the gap left by removing a clip.
	 */
	rippleDelete(
		elements: TimelineElement[],
		deletedStart: number,
		deletedDuration: number,
	): TimelineElement[] {
		return rippleDelete({ elements, deletedStart, deletedDuration });
	}

	/**
	 * Close all gaps on a track.
	 */
	closeGaps(elements: TimelineElement[]): TimelineElement[] {
		return closeGaps(elements);
	}

	// ── Queries ───────────────────────────────────────────────────

	getTracks(): TimelineTrack[] {
		return this.tracks;
	}

	getVersion(): number {
		return this.cachedVersion;
	}

	getResolver(): TimeResolver {
		return this.resolver;
	}
}
