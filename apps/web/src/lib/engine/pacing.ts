/**
 * Pacing Engine — analyse and score edit rhythm.
 *
 * Evaluates:
 *   - Average clip duration
 *   - Silence density (gaps between clips)
 *   - Cut frequency
 *   - Motion/energy score (based on clip density per window)
 *
 * The pacing score drives AI suggestions for trims, cuts and zoom.
 */

import type { TimelineTrack, TimelineElement } from "@/types/timeline";

export interface PacingMetrics {
	/** Average clip duration in seconds across all tracks. */
	averageClipDuration: number;
	/** Ratio of silence (gaps) to total duration [0, 1]. */
	silenceDensity: number;
	/** Cuts per minute across all tracks. */
	cutsPerMinute: number;
	/** Clip density score per analysis window [0, 1]. Higher = busier. */
	densityScore: number;
	/** Overall pacing score [0, 100]. Higher = faster paced. */
	overallScore: number;
	/** Per-window breakdown for the density curve. */
	densityCurve: WindowMetric[];
}

export interface WindowMetric {
	/** Window start time in seconds. */
	startTime: number;
	/** Window end time in seconds. */
	endTime: number;
	/** Number of active clips in this window. */
	activeClips: number;
	/** Number of cuts (clip boundaries) in this window. */
	cuts: number;
}

export interface PacingSuggestion {
	type: "trim" | "cut" | "zoom" | "speed-ramp";
	startTime: number;
	endTime: number;
	reason: string;
	confidence: number;
}

const DEFAULT_WINDOW_SECONDS = 5;

export function analyzePacing({
	tracks,
	totalDuration,
	windowSize = DEFAULT_WINDOW_SECONDS,
}: {
	tracks: TimelineTrack[];
	totalDuration: number;
	windowSize?: number;
}): PacingMetrics {
	if (totalDuration <= 0) {
		return {
			averageClipDuration: 0,
			silenceDensity: 1,
			cutsPerMinute: 0,
			densityScore: 0,
			overallScore: 0,
			densityCurve: [],
		};
	}

	const allElements = tracks.flatMap(
		(t) => t.elements as TimelineElement[],
	);
	const clipCount = allElements.length;

	// Average clip duration
	const totalClipTime = allElements.reduce(
		(sum, el) => sum + el.duration,
		0,
	);
	const averageClipDuration =
		clipCount > 0 ? totalClipTime / clipCount : 0;

	// Silence density: proportion of timeline not covered by any clip
	const covered = computeCoveredTime(allElements);
	const silenceDensity = 1 - Math.min(covered / totalDuration, 1);

	// Cuts per minute
	const cutCount = Math.max(0, clipCount - tracks.length); // approximate: boundaries minus track starts
	const cutsPerMinute =
		totalDuration > 0 ? (cutCount / totalDuration) * 60 : 0;

	// Windowed density curve
	const densityCurve = buildDensityCurve(
		allElements,
		totalDuration,
		windowSize,
	);

	const densityScore =
		densityCurve.length > 0
			? densityCurve.reduce((sum, w) => sum + w.activeClips, 0) /
				densityCurve.length /
				Math.max(tracks.length, 1)
			: 0;

	// Overall score: composite of pace signals [0, 100]
	const overallScore = computeOverallScore({
		averageClipDuration,
		silenceDensity,
		cutsPerMinute,
		densityScore,
	});

	return {
		averageClipDuration,
		silenceDensity,
		cutsPerMinute,
		densityScore,
		overallScore,
		densityCurve,
	};
}

/**
 * Suggest pacing improvements when the score is below a threshold.
 */
export function suggestPacingFixes({
	tracks,
	totalDuration,
	threshold = 40,
}: {
	tracks: TimelineTrack[];
	totalDuration: number;
	threshold?: number;
}): PacingSuggestion[] {
	const metrics = analyzePacing({ tracks, totalDuration });
	const suggestions: PacingSuggestion[] = [];

	if (metrics.overallScore >= threshold) return suggestions;

	// Detect long clips that could be trimmed
	const allElements = tracks.flatMap(
		(t) => t.elements as TimelineElement[],
	);
	const longThreshold = metrics.averageClipDuration * 2;

	for (const el of allElements) {
		if (el.duration > longThreshold && el.duration > 3) {
			suggestions.push({
				type: "trim",
				startTime: el.startTime,
				endTime: el.startTime + el.duration,
				reason: `Clip "${el.name}" is ${el.duration.toFixed(1)}s — ${(el.duration / metrics.averageClipDuration).toFixed(1)}x average duration`,
				confidence: Math.min(0.9, el.duration / (longThreshold * 2)),
			});
		}
	}

	// Detect long gaps (silence)
	const gaps = findGaps(allElements, totalDuration);
	for (const gap of gaps) {
		if (gap.duration > 1.5) {
			suggestions.push({
				type: "cut",
				startTime: gap.start,
				endTime: gap.end,
				reason: `${gap.duration.toFixed(1)}s gap — consider closing or adding B-roll`,
				confidence: Math.min(0.85, gap.duration / 5),
			});
		}
	}

	// Detect static sections (low cut density)
	for (const window of metrics.densityCurve) {
		if (window.cuts === 0 && window.activeClips <= 1) {
			suggestions.push({
				type: "zoom",
				startTime: window.startTime,
				endTime: window.endTime,
				reason: "Static section — consider adding a zoom or motion effect",
				confidence: 0.5,
			});
		}
	}

	return suggestions;
}

// ── Internal helpers ──────────────────────────────────────────────

function computeCoveredTime(elements: TimelineElement[]): number {
	if (elements.length === 0) return 0;

	// Merge overlapping intervals
	const intervals = elements
		.map((el) => ({ start: el.startTime, end: el.startTime + el.duration }))
		.sort((a, b) => a.start - b.start);

	let covered = 0;
	let curStart = intervals[0].start;
	let curEnd = intervals[0].end;

	for (let i = 1; i < intervals.length; i++) {
		const iv = intervals[i];
		if (iv.start <= curEnd) {
			curEnd = Math.max(curEnd, iv.end);
		} else {
			covered += curEnd - curStart;
			curStart = iv.start;
			curEnd = iv.end;
		}
	}
	covered += curEnd - curStart;

	return covered;
}

function buildDensityCurve(
	elements: TimelineElement[],
	totalDuration: number,
	windowSize: number,
): WindowMetric[] {
	const windows: WindowMetric[] = [];
	let t = 0;

	while (t < totalDuration) {
		const windowEnd = Math.min(t + windowSize, totalDuration);
		let activeClips = 0;
		let cuts = 0;

		for (const el of elements) {
			const elEnd = el.startTime + el.duration;
			// Active in window if overlap
			if (el.startTime < windowEnd && elEnd > t) {
				activeClips++;
			}
			// Count clip boundaries inside window
			if (el.startTime > t && el.startTime < windowEnd) cuts++;
			if (elEnd > t && elEnd < windowEnd) cuts++;
		}

		windows.push({
			startTime: t,
			endTime: windowEnd,
			activeClips,
			cuts,
		});

		t += windowSize;
	}

	return windows;
}

function computeOverallScore({
	averageClipDuration,
	silenceDensity,
	cutsPerMinute,
	densityScore,
}: {
	averageClipDuration: number;
	silenceDensity: number;
	cutsPerMinute: number;
	densityScore: number;
}): number {
	// Shorter clips → higher pace
	const clipScore =
		averageClipDuration > 0
			? Math.min(100, 30 / averageClipDuration) // 30s clips = low, 1s clips = high
			: 0;

	// Less silence → higher pace
	const silenceScore = (1 - silenceDensity) * 100;

	// More cuts → higher pace
	const cutScore = Math.min(100, cutsPerMinute * 5);

	// Density
	const densityPct = Math.min(100, densityScore * 100);

	// Weighted composite
	return Math.round(
		clipScore * 0.3 +
			silenceScore * 0.25 +
			cutScore * 0.25 +
			densityPct * 0.2,
	);
}

interface Gap {
	start: number;
	end: number;
	duration: number;
}

function findGaps(
	elements: TimelineElement[],
	totalDuration: number,
): Gap[] {
	if (elements.length === 0) {
		return totalDuration > 0
			? [{ start: 0, end: totalDuration, duration: totalDuration }]
			: [];
	}

	const intervals = elements
		.map((el) => ({ start: el.startTime, end: el.startTime + el.duration }))
		.sort((a, b) => a.start - b.start);

	// Merge overlapping
	const merged: Array<{ start: number; end: number }> = [intervals[0]];
	for (let i = 1; i < intervals.length; i++) {
		const last = merged[merged.length - 1];
		const cur = intervals[i];
		if (cur.start <= last.end) {
			last.end = Math.max(last.end, cur.end);
		} else {
			merged.push({ ...cur });
		}
	}

	const gaps: Gap[] = [];

	// Gap before first clip
	if (merged[0].start > 0) {
		gaps.push({
			start: 0,
			end: merged[0].start,
			duration: merged[0].start,
		});
	}

	// Gaps between clips
	for (let i = 0; i < merged.length - 1; i++) {
		const gapStart = merged[i].end;
		const gapEnd = merged[i + 1].start;
		if (gapEnd > gapStart) {
			gaps.push({
				start: gapStart,
				end: gapEnd,
				duration: gapEnd - gapStart,
			});
		}
	}

	// Gap after last clip
	const lastEnd = merged[merged.length - 1].end;
	if (lastEnd < totalDuration) {
		gaps.push({
			start: lastEnd,
			end: totalDuration,
			duration: totalDuration - lastEnd,
		});
	}

	return gaps;
}
