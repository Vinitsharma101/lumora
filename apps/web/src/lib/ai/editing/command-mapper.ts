/**
 * Command Mapper — Translates edit plan actions into deterministic timeline commands.
 *
 * Each plan action maps to one or more TimelineCommandUnion entries.
 * The AI never directly mutates timeline state — it only calls allowed commands
 * through this mapping layer.
 */

import type { EditorCore } from "@/core";
import { generateUUID } from "@/utils/id";
import type {
	PlanAction,
	EditPlan,
	TimelineCommandUnion,
} from "./types";

/**
 * Map a trim_silence action to DELETE/TRIM commands.
 */
function mapTrimSilence(
	action: PlanAction,
	editor: EditorCore,
): TimelineCommandUnion[] {
	const commands: TimelineCommandUnion[] = [];
	const start = action.parameters.start as number;
	const end = action.parameters.end as number;
	const trackId = action.parameters.trackId as string;
	const elementId = action.parameters.elementId as string;

	// If we have a specific element to trim, use TRIM command
	if (elementId) {
		commands.push({
			type: "TRIM",
			id: generateUUID(),
			trackId,
			elementId,
			trimStart: start,
			trimEnd: end,
		});
	} else {
		// Find elements that span the silence region and split/trim them
		const tracks = editor.timeline.getTracks();
		const track = tracks.find((t) => t.id === trackId);
		if (!track) return commands;

		for (const element of track.elements) {
			const elementEnd = element.startTime + element.duration;
			// Element overlaps the silence region
			if (element.startTime < end && elementEnd > start) {
				if (
					element.startTime >= start &&
					elementEnd <= end
				) {
					// Element is entirely within silence — delete it
					commands.push({
						type: "DELETE",
						id: generateUUID(),
						trackId,
						elementId: element.id,
					});
				} else if (element.startTime < start && elementEnd > end) {
					// Element spans the silence — split at both ends
					commands.push({
						type: "SPLIT",
						id: generateUUID(),
						trackId,
						elementId: element.id,
						splitTime: start,
						retainSide: "left",
					});
				}
			}
		}
	}

	return commands;
}

/**
 * Map a reduce_avg_clip_length action to SPLIT commands.
 * Cuts clips longer than the threshold at their midpoints.
 */
function mapReduceClipLength(
	action: PlanAction,
	editor: EditorCore,
): TimelineCommandUnion[] {
	const commands: TimelineCommandUnion[] = [];
	const targetAvgLength = action.parameters.targetAvgLength as number;
	const cutThreshold =
		(action.parameters.cutThreshold as number | undefined) ??
		targetAvgLength * 1.5;

	const tracks = editor.timeline.getTracks();

	for (const track of tracks) {
		if (track.type !== "video") continue;

		for (const element of track.elements) {
			if (element.duration > cutThreshold) {
				// Split at midpoint
				const midpoint = element.startTime + element.duration / 2;
				commands.push({
					type: "SPLIT",
					id: generateUUID(),
					trackId: track.id,
					elementId: element.id,
					splitTime: midpoint,
					retainSide: "both",
				});
			}
		}
	}

	return commands;
}

/**
 * Map an add_punch_zoom action to UPDATE_ELEMENT commands with transform changes.
 */
function mapPunchZoom(
	action: PlanAction,
	editor: EditorCore,
): TimelineCommandUnion[] {
	const commands: TimelineCommandUnion[] = [];
	const time = action.parameters.time as number;
	const scale = (action.parameters.scale as number | undefined) ?? 1.05;

	const tracks = editor.timeline.getTracks();

	// Find the video element that contains this timestamp
	for (const track of tracks) {
		if (track.type !== "video") continue;

		for (const element of track.elements) {
			const elementEnd = element.startTime + element.duration;
			if (time >= element.startTime && time < elementEnd) {
				commands.push({
					type: "ADD_EFFECT",
					id: generateUUID(),
					trackId: track.id,
					elementId: element.id,
					effect: {
						type: "punch_zoom",
						intensity: scale,
						startTime: time - element.startTime,
						duration: 0.3,
					},
				});
				break;
			}
		}
	}

	return commands;
}

/**
 * Map an insert_music action to INSERT_ELEMENT command.
 */
function mapInsertMusic(
	action: PlanAction,
): TimelineCommandUnion[] {
	const style = (action.parameters.style as string | undefined) ?? "upbeat";
	const duration = (action.parameters.duration as number | undefined) ?? 30;
	const startTime =
		(action.parameters.startTime as number | undefined) ?? 0;

	return [
		{
			type: "INSERT_ELEMENT",
			id: generateUUID(),
			element: {
				type: "audio",
				sourceType: "upload",
				mediaId: generateUUID(),
				name: `AI Music: ${style}`,
				duration,
				startTime,
				trimStart: 0,
				trimEnd: 0,
				volume: 0.3,
				muted: false,
			},
			placement: { mode: "auto" },
		},
	];
}

/**
 * Map add_transition actions to ADD_TRANSITION commands between clips.
 */
function mapAddTransitions(
	action: PlanAction,
	editor: EditorCore,
): TimelineCommandUnion[] {
	const commands: TimelineCommandUnion[] = [];
	const style =
		(action.parameters.style as string | undefined) ?? "dissolve";
	const duration =
		(action.parameters.duration as number | undefined) ?? 0.5;

	const tracks = editor.timeline.getTracks();

	for (const track of tracks) {
		if (track.type !== "video") continue;

		const sorted = [...track.elements].sort(
			(a, b) => a.startTime - b.startTime,
		);

		for (let index = 0; index < sorted.length - 1; index++) {
			const current = sorted[index];
			commands.push({
				type: "ADD_TRANSITION",
				id: generateUUID(),
				trackId: track.id,
				elementId: current.id,
				transition: {
					type: style,
					duration,
					direction: "out",
				},
			});
		}
	}

	return commands;
}

/**
 * Map an add_caption action to INSERT_ELEMENT commands.
 */
function mapAddCaption(
	action: PlanAction,
): TimelineCommandUnion[] {
	const style =
		(action.parameters.style as string | undefined) ?? "basic";

	return [
		{
			type: "INSERT_ELEMENT",
			id: generateUUID(),
			element: {
				type: "text",
				name: `AI Captions (${style})`,
				content: " ",
				duration: 3,
				startTime: 0,
				trimStart: 0,
				trimEnd: 0,
				fontSize: 5,
				fontFamily: "Inter",
				color: "#ffffff",
				background: { color: "#00000000" },
				textAlign: "center",
				fontWeight: "bold",
				transform: {
					scale: 1,
					position: { x: 0, y: 0.35 },
					rotate: 0,
				},
				opacity: 1,
			},
			placement: { mode: "auto" },
		},
	];
}

/**
 * Map add_text_overlay action to INSERT_ELEMENT.
 */
function mapAddTextOverlay(
	action: PlanAction,
): TimelineCommandUnion[] {
	const content =
		(action.parameters.content as string | undefined) ?? "Title";
	const startTime =
		(action.parameters.startTime as number | undefined) ?? 0;
	const duration =
		(action.parameters.duration as number | undefined) ?? 5;

	return [
		{
			type: "INSERT_ELEMENT",
			id: generateUUID(),
			element: {
				type: "text",
				name: content.slice(0, 30),
				content,
				duration,
				startTime,
				trimStart: 0,
				trimEnd: 0,
				fontSize: 12,
				fontFamily: "Inter",
				color: "#ffffff",
				background: { color: "#00000080" },
				textAlign: "center",
				fontWeight: "bold",
				transform: {
					scale: 1,
					position: { x: 0, y: 0 },
					rotate: 0,
				},
				opacity: 1,
			},
			placement: { mode: "auto" },
		},
	];
}

/**
 * Map adjust_volume action to UPDATE_VOLUME commands.
 */
function mapAdjustVolume(
	action: PlanAction,
	editor: EditorCore,
): TimelineCommandUnion[] {
	const commands: TimelineCommandUnion[] = [];
	const targetVolume =
		(action.parameters.volume as number | undefined) ?? 0.7;

	const tracks = editor.timeline.getTracks();

	for (const track of tracks) {
		if (track.type !== "audio") continue;
		for (const element of track.elements) {
			commands.push({
				type: "UPDATE_VOLUME",
				id: generateUUID(),
				trackId: track.id,
				elementId: element.id,
				volume: targetVolume,
			});
		}
	}

	return commands;
}

/**
 * Map a constrain_duration action by removing excess content from the end.
 */
function mapConstrainDuration(
	action: PlanAction,
	editor: EditorCore,
): TimelineCommandUnion[] {
	const commands: TimelineCommandUnion[] = [];
	const targetDuration = action.parameters.targetDuration as number;

	const tracks = editor.timeline.getTracks();

	for (const track of tracks) {
		for (const element of track.elements) {
			const elementEnd = element.startTime + element.duration;

			if (element.startTime >= targetDuration) {
				// Element starts after target — delete entirely
				commands.push({
					type: "DELETE",
					id: generateUUID(),
					trackId: track.id,
					elementId: element.id,
				});
			} else if (elementEnd > targetDuration) {
				// Element extends past target — trim it
				const newDuration = targetDuration - element.startTime;
				commands.push({
					type: "UPDATE_DURATION",
					id: generateUUID(),
					trackId: track.id,
					elementId: element.id,
					duration: newDuration,
				});
			}
		}
	}

	return commands;
}

/**
 * Map a single plan action to timeline commands.
 */
function mapAction(
	action: PlanAction,
	editor: EditorCore,
): TimelineCommandUnion[] {
	switch (action.type) {
		case "trim_silence":
			return mapTrimSilence(action, editor);
		case "reduce_avg_clip_length":
			return mapReduceClipLength(action, editor);
		case "add_punch_zoom":
			return mapPunchZoom(action, editor);
		case "insert_music":
			return mapInsertMusic(action);
		case "add_transition":
			return mapAddTransitions(action, editor);
		case "add_caption":
			return mapAddCaption(action);
		case "add_text_overlay":
			return mapAddTextOverlay(action);
		case "adjust_volume":
			return mapAdjustVolume(action, editor);
		case "constrain_duration":
			return mapConstrainDuration(action, editor);
		default:
			return [];
	}
}

/**
 * Map an entire edit plan to a list of timeline commands.
 * Actions are processed in priority order.
 */
export function mapPlanToCommands(
	plan: EditPlan,
	editor: EditorCore,
): TimelineCommandUnion[] {
	const allCommands: TimelineCommandUnion[] = [];

	for (const action of plan.actions) {
		const commands = mapAction(action, editor);
		allCommands.push(...commands);
	}

	return allCommands;
}
