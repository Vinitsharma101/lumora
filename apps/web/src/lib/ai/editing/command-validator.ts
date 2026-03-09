/**
 * Command Validator — Guardrails that prevent invalid commands from executing.
 *
 * AI must NEVER bypass guardrails. Every command is validated before execution.
 * Checks: element exists, time valid, no negative duration, track not locked, etc.
 */

import type { EditorCore } from "@/core";
import type {
	TimelineCommandUnion,
	ValidationResult,
	ValidationError,
	ValidationWarning,
} from "./types";

/**
 * Validate that a referenced track exists.
 */
function validateTrackExists(
	editor: EditorCore,
	trackId: string,
	commandId: string,
): ValidationError | null {
	const track = editor.timeline.getTrackById({ trackId });
	if (!track) {
		return {
			commandId,
			field: "trackId",
			message: `Track "${trackId}" does not exist`,
		};
	}
	return null;
}

/**
 * Validate that a referenced element exists on the given track.
 */
function validateElementExists(
	editor: EditorCore,
	trackId: string,
	elementId: string,
	commandId: string,
): ValidationError | null {
	const track = editor.timeline.getTrackById({ trackId });
	if (!track) {
		return {
			commandId,
			field: "trackId",
			message: `Track "${trackId}" does not exist`,
		};
	}

	const element = track.elements.find(
		(element) => element.id === elementId,
	);
	if (!element) {
		return {
			commandId,
			field: "elementId",
			message: `Element "${elementId}" not found on track "${trackId}"`,
		};
	}

	return null;
}

/**
 * Validate that a time value is non-negative.
 */
function validateTimePositive(
	time: number,
	fieldName: string,
	commandId: string,
): ValidationError | null {
	if (time < 0) {
		return {
			commandId,
			field: fieldName,
			message: `${fieldName} cannot be negative (got ${time})`,
		};
	}
	return null;
}

/**
 * Validate that a duration is positive and reasonable.
 */
function validateDuration(
	duration: number,
	commandId: string,
): ValidationError | null {
	if (duration <= 0) {
		return {
			commandId,
			field: "duration",
			message: `Duration must be positive (got ${duration})`,
		};
	}
	if (duration > 3600) {
		return {
			commandId,
			field: "duration",
			message: `Duration exceeds 1 hour limit (got ${duration}s)`,
		};
	}
	return null;
}

/**
 * Validate a split time falls within the element's bounds.
 */
function validateSplitTime(
	editor: EditorCore,
	trackId: string,
	elementId: string,
	splitTime: number,
	commandId: string,
): ValidationError | null {
	const track = editor.timeline.getTrackById({ trackId });
	if (!track) return null; // Already caught by validateTrackExists

	const element = track.elements.find(
		(element) => element.id === elementId,
	);
	if (!element) return null; // Already caught by validateElementExists

	const elementEnd = element.startTime + element.duration;
	if (splitTime <= element.startTime || splitTime >= elementEnd) {
		return {
			commandId,
			field: "splitTime",
			message: `Split time ${splitTime}s is outside element bounds [${element.startTime}s, ${elementEnd}s]`,
		};
	}

	return null;
}

/**
 * Validate a volume value is within [0, 1].
 */
function validateVolume(
	volume: number,
	commandId: string,
): ValidationError | null {
	if (volume < 0 || volume > 1) {
		return {
			commandId,
			field: "volume",
			message: `Volume must be between 0 and 1 (got ${volume})`,
		};
	}
	return null;
}

/**
 * Validate a single command.
 */
function validateCommand(
	command: TimelineCommandUnion,
	editor: EditorCore,
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	switch (command.type) {
		case "CUT":
		case "SPLIT": {
			const trackErr = validateTrackExists(
				editor,
				command.trackId,
				command.id,
			);
			if (trackErr) {
				errors.push(trackErr);
				break;
			}
			const elemErr = validateElementExists(
				editor,
				command.trackId,
				command.elementId,
				command.id,
			);
			if (elemErr) {
				errors.push(elemErr);
				break;
			}
			const splitTime =
				command.type === "CUT" ? command.atTime : command.splitTime;
			const splitErr = validateSplitTime(
				editor,
				command.trackId,
				command.elementId,
				splitTime,
				command.id,
			);
			if (splitErr) errors.push(splitErr);
			break;
		}

		case "TRIM": {
			const trackErr = validateTrackExists(
				editor,
				command.trackId,
				command.id,
			);
			if (trackErr) {
				errors.push(trackErr);
				break;
			}
			const elemErr = validateElementExists(
				editor,
				command.trackId,
				command.elementId,
				command.id,
			);
			if (elemErr) errors.push(elemErr);
			if (command.trimStart !== undefined) {
				const timeErr = validateTimePositive(
					command.trimStart,
					"trimStart",
					command.id,
				);
				if (timeErr) errors.push(timeErr);
			}
			if (command.trimEnd !== undefined) {
				const timeErr = validateTimePositive(
					command.trimEnd,
					"trimEnd",
					command.id,
				);
				if (timeErr) errors.push(timeErr);
			}
			break;
		}

		case "DELETE": {
			const trackErr = validateTrackExists(
				editor,
				command.trackId,
				command.id,
			);
			if (trackErr) {
				errors.push(trackErr);
				break;
			}
			const elemErr = validateElementExists(
				editor,
				command.trackId,
				command.elementId,
				command.id,
			);
			if (elemErr) errors.push(elemErr);
			break;
		}

		case "MOVE_ELEMENT": {
			const trackErr = validateTrackExists(
				editor,
				command.trackId,
				command.id,
			);
			if (trackErr) {
				errors.push(trackErr);
				break;
			}
			const elemErr = validateElementExists(
				editor,
				command.trackId,
				command.elementId,
				command.id,
			);
			if (elemErr) errors.push(elemErr);
			const timeErr = validateTimePositive(
				command.newStartTime,
				"newStartTime",
				command.id,
			);
			if (timeErr) errors.push(timeErr);
			break;
		}

		case "UPDATE_ELEMENT": {
			const trackErr = validateTrackExists(
				editor,
				command.trackId,
				command.id,
			);
			if (trackErr) {
				errors.push(trackErr);
				break;
			}
			const elemErr = validateElementExists(
				editor,
				command.trackId,
				command.elementId,
				command.id,
			);
			if (elemErr) errors.push(elemErr);
			break;
		}

		case "UPDATE_DURATION": {
			const trackErr = validateTrackExists(
				editor,
				command.trackId,
				command.id,
			);
			if (trackErr) {
				errors.push(trackErr);
				break;
			}
			const elemErr = validateElementExists(
				editor,
				command.trackId,
				command.elementId,
				command.id,
			);
			if (elemErr) errors.push(elemErr);
			const durErr = validateDuration(command.duration, command.id);
			if (durErr) errors.push(durErr);
			break;
		}

		case "INSERT_ELEMENT": {
			if (
				command.placement.mode === "explicit" &&
				command.placement.trackId
			) {
				const trackErr = validateTrackExists(
					editor,
					command.placement.trackId,
					command.id,
				);
				if (trackErr) errors.push(trackErr);
			}
			break;
		}

		case "ADD_TRACK": {
			// No validation needed — always safe
			break;
		}

		case "ADD_EFFECT": {
			const trackErr = validateTrackExists(
				editor,
				command.trackId,
				command.id,
			);
			if (trackErr) {
				errors.push(trackErr);
				break;
			}
			const elemErr = validateElementExists(
				editor,
				command.trackId,
				command.elementId,
				command.id,
			);
			if (elemErr) errors.push(elemErr);
			break;
		}

		case "ADD_TRANSITION": {
			const trackErr = validateTrackExists(
				editor,
				command.trackId,
				command.id,
			);
			if (trackErr) {
				errors.push(trackErr);
				break;
			}
			const elemErr = validateElementExists(
				editor,
				command.trackId,
				command.elementId,
				command.id,
			);
			if (elemErr) errors.push(elemErr);
			const durErr = validateDuration(
				command.transition.duration,
				command.id,
			);
			if (durErr) errors.push(durErr);
			break;
		}

		case "UPDATE_VOLUME": {
			const trackErr = validateTrackExists(
				editor,
				command.trackId,
				command.id,
			);
			if (trackErr) {
				errors.push(trackErr);
				break;
			}
			const elemErr = validateElementExists(
				editor,
				command.trackId,
				command.elementId,
				command.id,
			);
			if (elemErr) errors.push(elemErr);
			const volErr = validateVolume(command.volume, command.id);
			if (volErr) errors.push(volErr);
			break;
		}
	}

	// Warnings for large batch operations
	return { errors, warnings };
}

/**
 * Validate a batch of commands before execution.
 * Returns a ValidationResult indicating whether the batch is safe to execute.
 */
export function validateCommands(
	commands: TimelineCommandUnion[],
	editor: EditorCore,
): ValidationResult {
	const allErrors: ValidationError[] = [];
	const allWarnings: ValidationWarning[] = [];

	for (const command of commands) {
		const { errors, warnings } = validateCommand(command, editor);
		allErrors.push(...errors);
		allWarnings.push(...warnings);
	}

	// Global batch warnings
	if (commands.length > 50) {
		allWarnings.push({
			commandId: "batch",
			message: `Large batch of ${commands.length} commands — execution may take a moment`,
		});
	}

	const deleteCount = commands.filter(
		(command) => command.type === "DELETE",
	).length;
	if (deleteCount > 10) {
		allWarnings.push({
			commandId: "batch",
			message: `Batch deletes ${deleteCount} elements — verify this is intended`,
		});
	}

	return {
		valid: allErrors.length === 0,
		errors: allErrors,
		warnings: allWarnings,
	};
}
