/**
 * Timeline Analyzer — Generates a rich intelligence snapshot of the timeline.
 *
 * Before AI edits anything, it must understand the current state. This module
 * produces measurable metrics that inform the Edit Planner. The AI never
 * edits blindly — it edits based on quantified timeline state.
 */

import type { EditorCore } from "@/core";
import type { TimelineTrack, TimelineElement } from "@/types/timeline";
import type { TimelineMetrics, SilenceSegment, GapSegment } from "./types";

/**
 * Find gaps between elements on a given track.
 * A gap is any region of the track with no element coverage.
 */
function findGapsOnTrack(track: TimelineTrack): GapSegment[] {
	const gaps: GapSegment[] = [];
	if (track.elements.length === 0) return gaps;

	const sorted = [...track.elements].sort(
		(a, b) => a.startTime - b.startTime,
	);

	// Gap before first element
	if (sorted[0].startTime > 0.1) {
		gaps.push({
			start: 0,
			end: sorted[0].startTime,
			duration: sorted[0].startTime,
			trackId: track.id,
		});
	}

	// Gaps between consecutive elements
	for (let index = 0; index < sorted.length - 1; index++) {
		const current = sorted[index];
		const next = sorted[index + 1];
		const currentEnd = current.startTime + current.duration;
		const gapDuration = next.startTime - currentEnd;

		if (gapDuration > 0.05) {
			gaps.push({
				start: currentEnd,
				end: next.startTime,
				duration: gapDuration,
				trackId: track.id,
			});
		}
	}

	return gaps;
}

/**
 * Detect silence segments on audio/video tracks by finding gaps
 * where audio elements are absent or muted.
 */
function findSilenceSegments(
	tracks: TimelineTrack[],
	totalDuration: number,
): SilenceSegment[] {
	const segments: SilenceSegment[] = [];

	// Get all audio-producing tracks (audio + unmuted video)
	const audioTracks = tracks.filter(
		(track) =>
			track.type === "audio" ||
			(track.type === "video" && !("muted" in track && track.muted)),
	);

	if (audioTracks.length === 0) return segments;

	// Build a coverage map at 0.1s resolution
	const resolution = 0.1;
	const slots = Math.ceil(totalDuration / resolution);
	const coverage = new Uint8Array(slots);

	for (const track of audioTracks) {
		for (const element of track.elements) {
			if ("muted" in element && element.muted) continue;
			const startSlot = Math.floor(element.startTime / resolution);
			const endSlot = Math.min(
				slots,
				Math.ceil((element.startTime + element.duration) / resolution),
			);
			for (let slot = startSlot; slot < endSlot; slot++) {
				coverage[slot] = 1;
			}
		}
	}

	// Find continuous uncovered regions
	let silenceStart: number | null = null;
	for (let slot = 0; slot < slots; slot++) {
		if (coverage[slot] === 0 && silenceStart === null) {
			silenceStart = slot * resolution;
		} else if (coverage[slot] === 1 && silenceStart !== null) {
			const silenceEnd = slot * resolution;
			const duration = silenceEnd - silenceStart;
			if (duration >= 0.2) {
				segments.push({
					start: silenceStart,
					end: silenceEnd,
					duration,
					trackId: audioTracks[0].id,
					elementId: "",
				});
			}
			silenceStart = null;
		}
	}

	// Trailing silence
	if (silenceStart !== null) {
		const duration = totalDuration - silenceStart;
		if (duration >= 0.2) {
			segments.push({
				start: silenceStart,
				end: totalDuration,
				duration,
				trackId: audioTracks[0].id,
				elementId: "",
			});
		}
	}

	return segments;
}

/**
 * Calculate an energy score (0-1) based on pacing and density.
 * Higher score = more energetic / faster paced.
 */
function calculateEnergyScore(
	clips: TimelineElement[],
	totalDuration: number,
): number {
	if (clips.length === 0 || totalDuration === 0) return 0;

	const avgLength =
		clips.reduce((sum, clip) => sum + clip.duration, 0) / clips.length;
	const cutsPerMinute = (clips.length / totalDuration) * 60;

	// Energy increases with more cuts and shorter clips
	const pacingEnergy = Math.min(1.0, cutsPerMinute / 30);
	const clipEnergy = Math.min(1.0, Math.max(0, 1 - avgLength / 10));

	return pacingEnergy * 0.6 + clipEnergy * 0.4;
}

/**
 * Calculate a pacing score (0-1) measuring consistency of clip lengths.
 * Higher score = more consistent pacing.
 */
function calculatePacingScore(clips: TimelineElement[]): number {
	if (clips.length < 2) return 1.0;

	const durations = clips.map((clip) => clip.duration);
	const avg =
		durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
	const variance =
		durations.reduce(
			(sum, duration) => sum + (duration - avg) ** 2,
			0,
		) / durations.length;
	const stdDev = Math.sqrt(variance);

	// Lower variance relative to mean = more consistent = higher score
	const coeffOfVariation = avg > 0 ? stdDev / avg : 0;
	return Math.max(0, 1 - coeffOfVariation);
}

/**
 * Calculate what percentage of the timeline has caption coverage.
 */
function calculateCaptionCoverage(
	tracks: TimelineTrack[],
	totalDuration: number,
): number {
	if (totalDuration === 0) return 0;

	const textTracks = tracks.filter((track) => track.type === "text");
	if (textTracks.length === 0) return 0;

	// Build coverage at 0.1s resolution
	const resolution = 0.1;
	const slots = Math.ceil(totalDuration / resolution);
	const coverage = new Uint8Array(slots);

	for (const track of textTracks) {
		for (const element of track.elements) {
			const startSlot = Math.floor(element.startTime / resolution);
			const endSlot = Math.min(
				slots,
				Math.ceil((element.startTime + element.duration) / resolution),
			);
			for (let slot = startSlot; slot < endSlot; slot++) {
				coverage[slot] = 1;
			}
		}
	}

	let covered = 0;
	for (let slot = 0; slot < slots; slot++) {
		if (coverage[slot] === 1) covered++;
	}

	return covered / slots;
}

/**
 * Analyze the current timeline and produce a comprehensive metrics snapshot.
 * This is the AI's "eyes" before it makes any decisions.
 */
export function analyzeTimeline(editor: EditorCore): TimelineMetrics {
	const tracks = editor.timeline.getTracks();
	const totalDuration = editor.timeline.getTotalDuration();

	// Collect all elements across all tracks
	const allElements: TimelineElement[] = [];
	const elementsByType: Record<string, number> = {};

	for (const track of tracks) {
		for (const element of track.elements) {
			allElements.push(element);
			elementsByType[element.type] =
				(elementsByType[element.type] ?? 0) + 1;
		}
	}

	// Clip length statistics
	const durations = allElements.map((element) => element.duration);
	const sortedDurations = [...durations].sort((a, b) => a - b);

	const avgClipLength =
		durations.length > 0
			? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
			: 0;

	const medianClipLength =
		sortedDurations.length > 0
			? sortedDurations.length % 2 === 0
				? (sortedDurations[sortedDurations.length / 2 - 1] +
						sortedDurations[sortedDurations.length / 2]) /
					2
				: sortedDurations[Math.floor(sortedDurations.length / 2)]
			: 0;

	// Gaps across all tracks
	const gapSegments: GapSegment[] = [];
	for (const track of tracks) {
		const trackGaps = findGapsOnTrack(track);
		gapSegments.push(...trackGaps);
	}

	// Silence analysis
	const silenceSegments = findSilenceSegments(tracks, totalDuration);
	const totalSilenceDuration = silenceSegments.reduce(
		(sum, segment) => sum + segment.duration,
		0,
	);

	// Music detection
	const hasMusic = tracks.some(
		(track) =>
			track.type === "audio" &&
			track.elements.some(
				(element) => element.duration > 10,
			),
	);

	// Caption detection
	const hasCaptions = tracks.some(
		(track) => track.type === "text" && track.elements.length > 0,
	);

	return {
		duration: totalDuration,
		avgClipLength,
		medianClipLength,
		minClipLength: sortedDurations.at(0) ?? 0,
		maxClipLength: sortedDurations.at(-1) ?? 0,
		clipCount: allElements.length,
		trackCount: tracks.length,
		silenceSegments,
		totalSilenceDuration,
		energyScore: calculateEnergyScore(allElements, totalDuration),
		pacingScore: calculatePacingScore(allElements),
		captionCoverage: calculateCaptionCoverage(tracks, totalDuration),
		hasMusic,
		hasCaptions,
		elementsByType,
		gapSegments,
	};
}
