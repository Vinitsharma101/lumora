/**
 * AI Editing Session — Manages reversible, auditable AI editing sessions.
 *
 * Each AI session produces a batch of commands wrapped in a single undo entry.
 * Users can: accept, reject, step through changes, or revert the entire batch.
 * This is how professional tools feel safe.
 */

import type { EditorCore } from "@/core";
import { BatchCommand } from "@/lib/commands";
import { TracksSnapshotCommand } from "@/lib/commands/timeline";
import type { TimelineTrack } from "@/types/timeline";
import { generateUUID } from "@/utils/id";
import type {
	AiEditingSession,
	ParsedIntent,
	EditPlan,
	TimelineCommandUnion,
	ValidationResult,
	SessionStatus,
} from "./types";

/**
 * Manages the lifecycle of AI editing sessions.
 * Each session is a self-contained, reversible batch of edits.
 */
export class AiSessionManager {
	private sessions: Map<string, AiEditingSession> = new Map();
	private snapshotsBefore: Map<string, TimelineTrack[]> = new Map();

	/**
	 * Create a new AI editing session.
	 */
	createSession(intent: ParsedIntent): AiEditingSession {
		const session: AiEditingSession = {
			id: generateUUID(),
			status: "planning",
			intent,
			plan: null,
			commands: [],
			validation: null,
			createdAt: Date.now(),
			executedAt: null,
			error: null,
		};

		this.sessions.set(session.id, session);
		return session;
	}

	/**
	 * Update the session with a generated plan.
	 */
	setPlan(sessionId: string, plan: EditPlan): void {
		const session = this.sessions.get(sessionId);
		if (!session) return;
		session.plan = plan;
	}

	/**
	 * Update the session with mapped commands and validation results.
	 */
	setCommands(
		sessionId: string,
		commands: TimelineCommandUnion[],
		validation: ValidationResult,
	): void {
		const session = this.sessions.get(sessionId);
		if (!session) return;
		session.commands = commands;
		session.validation = validation;
		session.status = validation.valid ? "ready" : "failed";
		if (!validation.valid) {
			session.error = validation.errors
				.map((error) => error.message)
				.join("; ");
		}
	}

	/**
	 * Execute all commands in a session as a single undo-able batch.
	 * Captures the timeline state before execution for rollback.
	 */
	executeSession(sessionId: string, editor: EditorCore): boolean {
		const session = this.sessions.get(sessionId);
		if (!session || session.status !== "ready") return false;

		// Capture state before AI edits
		const tracksBefore = editor.timeline.getTracks();
		this.snapshotsBefore.set(sessionId, tracksBefore);

		session.status = "executing";

		try {
			this.executeCommands(session.commands, editor);

			// Capture state after AI edits and push as single undo entry
			const tracksAfter = editor.timeline.getTracks();
			const snapshotCommand = new TracksSnapshotCommand(
				tracksBefore,
				tracksAfter,
			);

			// Replace the internal state changes with a single undo entry
			// by undoing all the individual changes and then executing the snapshot
			editor.timeline.updateTracks(tracksBefore);
			editor.command.execute({ command: snapshotCommand });

			session.status = "completed";
			session.executedAt = Date.now();
			return true;
		} catch (error) {
			// Rollback on failure
			editor.timeline.updateTracks(tracksBefore);
			session.status = "failed";
			session.error =
				error instanceof Error ? error.message : "Unknown execution error";
			return false;
		}
	}

	/**
	 * Execute commands against the editor timeline.
	 * Each command type maps to the appropriate TimelineManager method.
	 */
	private executeCommands(
		commands: TimelineCommandUnion[],
		editor: EditorCore,
	): void {
		for (const command of commands) {
			switch (command.type) {
				case "SPLIT": {
					editor.timeline.splitElements({
						elements: [
							{ trackId: command.trackId, elementId: command.elementId },
						],
						splitTime: command.splitTime,
						retainSide: command.retainSide,
					});
					break;
				}
				case "DELETE": {
					editor.timeline.deleteElements({
						elements: [
							{ trackId: command.trackId, elementId: command.elementId },
						],
					});
					break;
				}
				case "TRIM": {
					editor.timeline.updateElementTrim({
						elementId: command.elementId,
						trimStart: command.trimStart ?? 0,
						trimEnd: command.trimEnd ?? 0,
						pushHistory: false,
					});
					break;
				}
				case "INSERT_ELEMENT": {
					editor.timeline.insertElement({
						element: command.element as Parameters<
							typeof editor.timeline.insertElement
						>[0]["element"],
						placement: command.placement as Parameters<
							typeof editor.timeline.insertElement
						>[0]["placement"],
					});
					break;
				}
				case "MOVE_ELEMENT": {
					editor.timeline.updateElementStartTime({
						elements: [
							{ trackId: command.trackId, elementId: command.elementId },
						],
						startTime: command.newStartTime,
					});
					break;
				}
				case "UPDATE_ELEMENT": {
					editor.timeline.updateElements({
						updates: [
							{
								trackId: command.trackId,
								elementId: command.elementId,
								updates: command.updates,
							},
						],
						pushHistory: false,
					});
					break;
				}
				case "UPDATE_DURATION": {
					editor.timeline.updateElementDuration({
						trackId: command.trackId,
						elementId: command.elementId,
						duration: command.duration,
						pushHistory: false,
					});
					break;
				}
				case "ADD_TRACK": {
					editor.timeline.addTrack({
						type: command.trackType as "video" | "audio" | "text",
					});
					break;
				}
				case "ADD_EFFECT": {
					editor.timeline.updateElements({
						updates: [
							{
								trackId: command.trackId,
								elementId: command.elementId,
								updates: {
									effects: [command.effect],
								},
							},
						],
						pushHistory: false,
					});
					break;
				}
				case "ADD_TRANSITION": {
					editor.timeline.updateElements({
						updates: [
							{
								trackId: command.trackId,
								elementId: command.elementId,
								updates: {
									transitions: [command.transition],
								},
							},
						],
						pushHistory: false,
					});
					break;
				}
				case "UPDATE_VOLUME": {
					editor.timeline.updateElements({
						updates: [
							{
								trackId: command.trackId,
								elementId: command.elementId,
								updates: { volume: command.volume },
							},
						],
						pushHistory: false,
					});
					break;
				}
				case "CUT": {
					editor.timeline.splitElements({
						elements: [
							{ trackId: command.trackId, elementId: command.elementId },
						],
						splitTime: command.atTime,
						retainSide: "both",
					});
					break;
				}
			}
		}
	}

	/**
	 * Reject/rollback a completed session by undoing the batch command.
	 */
	rollbackSession(sessionId: string, editor: EditorCore): boolean {
		const session = this.sessions.get(sessionId);
		if (!session || session.status !== "completed") return false;

		if (editor.command.canUndo()) {
			editor.command.undo();
			session.status = "rolled_back";
			return true;
		}

		// Fallback: restore from snapshot
		const snapshot = this.snapshotsBefore.get(sessionId);
		if (snapshot) {
			editor.timeline.updateTracks(snapshot);
			session.status = "rolled_back";
			return true;
		}

		return false;
	}

	/**
	 * Get a session by ID.
	 */
	getSession(sessionId: string): AiEditingSession | undefined {
		return this.sessions.get(sessionId);
	}

	/**
	 * Get all sessions, most recent first.
	 */
	getAllSessions(): AiEditingSession[] {
		return [...this.sessions.values()].sort(
			(a, b) => b.createdAt - a.createdAt,
		);
	}

	/**
	 * Remove a session from history.
	 */
	removeSession(sessionId: string): void {
		this.sessions.delete(sessionId);
		this.snapshotsBefore.delete(sessionId);
	}

	/**
	 * Clear all sessions.
	 */
	clear(): void {
		this.sessions.clear();
		this.snapshotsBefore.clear();
	}
}
