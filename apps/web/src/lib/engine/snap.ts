/**
 * Magnetic and smart snap engine.
 *
 * Extends the existing snap-utils with:
 *   - Beat marker snapping (audio-driven)
 *   - Sentence boundary snapping (caption-driven)
 *   - Configurable snap threshold in frames
 *   - Magnetic insert mode (ripple-push adjacent clips)
 *   - Gap-closing on delete (ripple delete)
 */

import type {
	TimelineTrack,
	TimelineElement,
	Bookmark,
} from "@/types/timeline";

export interface SnapConfig {
	/** Snap threshold in frames at the current fps. Default 5. */
	thresholdFrames: number;
	/** Current frame rate. */
	fps: number;
	/** Enable snapping to other clip edges. */
	snapToClips: boolean;
	/** Enable snapping to playhead. */
	snapToPlayhead: boolean;
	/** Enable snapping to bookmarks. */
	snapToBookmarks: boolean;
	/** Enable snapping to beat markers. */
	snapToBeats: boolean;
	/** Enable snapping to caption boundaries. */
	snapToCaptions: boolean;
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
	thresholdFrames: 5,
	fps: 30,
	snapToClips: true,
	snapToPlayhead: true,
	snapToBookmarks: true,
	snapToBeats: false,
	snapToCaptions: false,
};

export interface MagneticSnapPoint {
	time: number;
	type:
		| "clip-start"
		| "clip-end"
		| "playhead"
		| "bookmark"
		| "beat"
		| "caption-start"
		| "caption-end";
	label?: string;
}

export interface MagneticSnapResult {
	snappedTime: number;
	matchedPoint: MagneticSnapPoint | null;
	distance: number;
}

/**
 * Collect all snap points based on the current config.
 */
export function collectSnapPoints({
	config,
	tracks,
	playheadTime,
	excludeElementId,
	bookmarks = [],
	beatMarkers = [],
	captionBoundaries = [],
}: {
	config: SnapConfig;
	tracks: TimelineTrack[];
	playheadTime: number;
	excludeElementId?: string;
	bookmarks?: Bookmark[];
	beatMarkers?: number[];
	captionBoundaries?: Array<{ start: number; end: number; text: string }>;
}): MagneticSnapPoint[] {
	const points: MagneticSnapPoint[] = [];

	if (config.snapToClips) {
		for (const track of tracks) {
			for (const el of track.elements) {
				if (el.id === excludeElementId) continue;
				points.push(
					{ time: el.startTime, type: "clip-start" },
					{ time: el.startTime + el.duration, type: "clip-end" },
				);
			}
		}
	}

	if (config.snapToPlayhead) {
		points.push({ time: playheadTime, type: "playhead" });
	}

	if (config.snapToBookmarks) {
		for (const bm of bookmarks) {
			points.push({ time: bm.time, type: "bookmark", label: bm.note });
		}
	}

	if (config.snapToBeats) {
		for (const beat of beatMarkers) {
			points.push({ time: beat, type: "beat" });
		}
	}

	if (config.snapToCaptions) {
		for (const caption of captionBoundaries) {
			points.push({
				time: caption.start,
				type: "caption-start",
				label: caption.text,
			});
			points.push({
				time: caption.end,
				type: "caption-end",
				label: caption.text,
			});
		}
	}

	return points;
}

/**
 * Snap a target time to the nearest point within threshold.
 */
export function magneticSnap({
	targetTime,
	points,
	config,
}: {
	targetTime: number;
	points: MagneticSnapPoint[];
	config: SnapConfig;
}): MagneticSnapResult {
	const thresholdSeconds = config.thresholdFrames / config.fps;

	let closest: MagneticSnapPoint | null = null;
	let closestDist = Infinity;

	for (const point of points) {
		const dist = Math.abs(targetTime - point.time);
		if (dist < thresholdSeconds && dist < closestDist) {
			closestDist = dist;
			closest = point;
		}
	}

	return {
		snappedTime: closest ? closest.time : targetTime,
		matchedPoint: closest,
		distance: closestDist,
	};
}

/**
 * Ripple insert: push all subsequent clips on the track forward by `duration`.
 */
export function rippleInsert({
	elements,
	insertTime,
	insertDuration,
}: {
	elements: TimelineElement[];
	insertTime: number;
	insertDuration: number;
}): TimelineElement[] {
	return elements.map((el) => {
		if (el.startTime >= insertTime) {
			return { ...el, startTime: el.startTime + insertDuration };
		}
		return el;
	});
}

/**
 * Ripple delete: close the gap left by removing a clip.
 */
export function rippleDelete({
	elements,
	deletedStart,
	deletedDuration,
}: {
	elements: TimelineElement[];
	deletedStart: number;
	deletedDuration: number;
}): TimelineElement[] {
	return elements
		.filter(
			(el) =>
				!(
					el.startTime >= deletedStart &&
					el.startTime + el.duration <= deletedStart + deletedDuration
				),
		)
		.map((el) => {
			if (el.startTime >= deletedStart + deletedDuration) {
				return { ...el, startTime: el.startTime - deletedDuration };
			}
			return el;
		});
}

/**
 * Close all gaps on a track, pushing clips left so no silence remains.
 */
export function closeGaps(elements: TimelineElement[]): TimelineElement[] {
	const sorted = [...elements].sort((a, b) => a.startTime - b.startTime);
	const result: TimelineElement[] = [];
	let cursor = 0;

	for (const el of sorted) {
		result.push({ ...el, startTime: cursor });
		cursor += el.duration;
	}

	return result;
}
