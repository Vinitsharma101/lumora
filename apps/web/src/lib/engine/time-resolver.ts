/**
 * TimeResolver — O(log n) clip lookup by time.
 *
 * Builds per-track interval trees from the current track/element state.
 * Provides frame-accurate resolution of which clips are active at any
 * given timeline time, replacing the naive linear scan.
 *
 * Usage:
 *   const resolver = new TimeResolver(tracks);
 *   const active = resolver.resolveAt(currentTimeInSeconds);
 */

import type { TimelineTrack, TimelineElement } from "@/types/timeline";
import { IntervalTree, type TimeInterval } from "./interval-tree";

export interface ResolvedClip {
	trackId: string;
	trackIndex: number;
	element: TimelineElement;
	/** Time within the source media (accounts for trimStart). */
	sourceTime: number;
}

interface TrackEntry {
	trackId: string;
	trackIndex: number;
	tree: IntervalTree<TimelineElement>;
}

export class TimeResolver {
	private entries: TrackEntry[];
	private version: number;

	constructor(tracks: TimelineTrack[], version = 0) {
		this.version = version;
		this.entries = tracks.map((track, index) => {
			const intervals: TimeInterval<TimelineElement>[] = track.elements.map(
				(el) => ({
					start: el.startTime,
					end: el.startTime + el.duration,
					data: el,
				}),
			);
			return {
				trackId: track.id,
				trackIndex: index,
				tree: IntervalTree.from(intervals),
			};
		});
	}

	getVersion(): number {
		return this.version;
	}

	/**
	 * Resolve all active clips at a given time.
	 * Returns clips bottom-to-top (first track = bottom layer).
	 */
	resolveAt(timelineTime: number): ResolvedClip[] {
		const results: ResolvedClip[] = [];

		for (const entry of this.entries) {
			const hits = entry.tree.query(timelineTime);
			for (const hit of hits) {
				const el = hit.data;
				const sourceTime =
					el.trimStart + (timelineTime - el.startTime);

				results.push({
					trackId: entry.trackId,
					trackIndex: entry.trackIndex,
					element: el,
					sourceTime,
				});
			}
		}

		return results;
	}

	/**
	 * Resolve active clips within a time range (e.g. for cache warming).
	 */
	resolveRange(
		startTime: number,
		endTime: number,
	): ResolvedClip[] {
		const results: ResolvedClip[] = [];

		for (const entry of this.entries) {
			const hits = entry.tree.queryRange(startTime, endTime);
			for (const hit of hits) {
				const el = hit.data;
				const clampedStart = Math.max(startTime, el.startTime);
				const sourceTime =
					el.trimStart + (clampedStart - el.startTime);

				results.push({
					trackId: entry.trackId,
					trackIndex: entry.trackIndex,
					element: el,
					sourceTime,
				});
			}
		}

		return results;
	}

	/**
	 * Find the single active clip on a specific track at time T.
	 * Returns null if no clip is active.
	 */
	resolveTrackAt(
		trackId: string,
		timelineTime: number,
	): ResolvedClip | null {
		const entry = this.entries.find((e) => e.trackId === trackId);
		if (!entry) return null;

		const hits = entry.tree.query(timelineTime);
		if (hits.length === 0) return null;

		const el = hits[0].data;
		return {
			trackId: entry.trackId,
			trackIndex: entry.trackIndex,
			element: el,
			sourceTime: el.trimStart + (timelineTime - el.startTime),
		};
	}
}
