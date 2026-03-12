/**
 * Timeline serialisation — export/import in multiple formats.
 *
 * Supports:
 *   - JSON  (native Grace Studio format)
 *   - EDL   (Edit Decision List — legacy NLE interchange)
 */

import type { TimelineTrack, TimelineElement, TScene } from "@/types/timeline";
import { ticksToTimecode, secondsToTicks } from "./time";

// ── JSON ──────────────────────────────────────────────────────────

export interface TimelineJSON {
	version: number;
	fps: number;
	scenes: SerializedScene[];
}

interface SerializedScene {
	id: string;
	name: string;
	isMain: boolean;
	tracks: TimelineTrack[];
	bookmarks: Array<{ time: number; note?: string; color?: string }>;
}

export function serializeToJSON(
	scenes: TScene[],
	fps: number,
): TimelineJSON {
	return {
		version: 1,
		fps,
		scenes: scenes.map((scene) => ({
			id: scene.id,
			name: scene.name,
			isMain: scene.isMain,
			tracks: scene.tracks,
			bookmarks: scene.bookmarks.map((b) => ({
				time: b.time,
				note: b.note,
				color: b.color,
			})),
		})),
	};
}

export function deserializeFromJSON(json: TimelineJSON): {
	scenes: TScene[];
	fps: number;
} {
	const now = new Date();
	return {
		fps: json.fps,
		scenes: json.scenes.map((s) => ({
			id: s.id,
			name: s.name,
			isMain: s.isMain,
			tracks: s.tracks,
			bookmarks: s.bookmarks,
			createdAt: now,
			updatedAt: now,
		})),
	};
}

// ── EDL ───────────────────────────────────────────────────────────

/**
 * Export as CMX 3600 EDL (simplified).
 * This is a text-based format compatible with Premiere, DaVinci, etc.
 */
export function exportToEDL(
	tracks: TimelineTrack[],
	fps: number,
	title = "Grace Studio Export",
): string {
	const lines: string[] = [];
	lines.push(`TITLE: ${title}`);
	lines.push(`FCM: NON-DROP FRAME`);
	lines.push("");

	let editNumber = 1;

	for (const track of tracks) {
		for (const element of track.elements) {
			const srcIn = ticksToTimecode(
				secondsToTicks(element.trimStart),
				fps,
			);
			const srcOut = ticksToTimecode(
				secondsToTicks(element.trimStart + element.duration),
				fps,
			);
			const recIn = ticksToTimecode(
				secondsToTicks(element.startTime),
				fps,
			);
			const recOut = ticksToTimecode(
				secondsToTicks(element.startTime + element.duration),
				fps,
			);

			const reelName = getReelName(element);
			const editNum = String(editNumber).padStart(3, "0");
			const channel = getEDLChannel(element);

			lines.push(
				`${editNum}  ${reelName}  ${channel}  C  ${srcIn} ${srcOut} ${recIn} ${recOut}`,
			);

			if (element.name) {
				lines.push(`* FROM CLIP NAME: ${element.name}`);
			}

			lines.push("");
			editNumber++;
		}
	}

	return lines.join("\n");
}

function getReelName(element: TimelineElement): string {
	if ("mediaId" in element) {
		return String(element.mediaId).slice(0, 8).toUpperCase().padEnd(8, " ");
	}
	return "AX      ";
}

function getEDLChannel(element: TimelineElement): string {
	switch (element.type) {
		case "video":
		case "image":
			return "V";
		case "audio":
			return "A";
		default:
			return "V";
	}
}
