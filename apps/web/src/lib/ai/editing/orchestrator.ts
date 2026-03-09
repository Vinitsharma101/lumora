/**
 * AI Editing Orchestrator — The complete brain-to-hands bridge.
 *
 * Pipeline:
 *   User Prompt → Intent Parser → Timeline Analyzer → Edit Planner
 *   → Command Mapper → Command Validator → Execute → Event Log
 *
 * The AI never directly mutates timeline state. It only issues
 * structured, validated, reversible commands through this pipeline.
 */

import type { EditorCore } from "@/core";
import { parseIntent } from "./intent-parser";
import { analyzeTimeline } from "./timeline-analyzer";
import { generateEditPlan } from "./edit-planner";
import { mapPlanToCommands } from "./command-mapper";
import { validateCommands } from "./command-validator";
import { AiSessionManager } from "./ai-editing-session";
import type {
	AiEditResult,
	AiEditingSession,
	ParsedIntent,
	EditPlan,
	TimelineMetrics,
	TimelineCommandUnion,
	ValidationResult,
} from "./types";

export type { AiEditResult, AiEditingSession, ParsedIntent, EditPlan, TimelineMetrics };

/**
 * The AiEditingOrchestrator coordinates the full pipeline from
 * natural language prompt to executed timeline commands.
 */
export class AiEditingOrchestrator {
	private sessionManager: AiSessionManager;

	constructor() {
		this.sessionManager = new AiSessionManager();
	}

	// ── Full Pipeline ──────────────────────────────────────────────

	/**
	 * Execute the full AI editing pipeline:
	 * prompt → intent → analyze → plan → commands → validate → execute
	 *
	 * Returns the session with results. If validation fails, the session
	 * is in "failed" status with error details.
	 */
	execute(prompt: string, editor: EditorCore): AiEditResult {
		// Step 1: Parse intent
		const intent = parseIntent(prompt);

		// Step 2: Create session
		const session = this.sessionManager.createSession(intent);

		// Step 3: Analyze timeline
		const metrics = analyzeTimeline(editor);

		// Step 4: Generate edit plan
		const plan = generateEditPlan(intent, metrics);
		this.sessionManager.setPlan(session.id, plan);

		if (plan.actions.length === 0) {
			const updatedSession = this.sessionManager.getSession(session.id);
			return {
				success: false,
				session: updatedSession ?? session,
				commandsExecuted: 0,
				canUndo: false,
				error: "No edit actions generated for the given prompt.",
			};
		}

		// Step 5: Map plan to commands
		const commands = mapPlanToCommands(plan, editor);

		// Step 6: Validate commands
		const validation = validateCommands(commands, editor);
		this.sessionManager.setCommands(session.id, commands, validation);

		if (!validation.valid) {
			const updatedSession = this.sessionManager.getSession(session.id);
			return {
				success: false,
				session: updatedSession ?? session,
				commandsExecuted: 0,
				canUndo: false,
				validation,
				error: `Validation failed: ${validation.errors.map((e) => e.message).join("; ")}`,
			};
		}

		// Step 7: Execute
		const executionSuccess = this.sessionManager.executeSession(session.id, editor);
		const finalSession = this.sessionManager.getSession(session.id);

		return {
			success: executionSuccess,
			session: finalSession ?? session,
			commandsExecuted: executionSuccess ? commands.length : 0,
			canUndo: executionSuccess,
			validation,
			error: executionSuccess ? undefined : "Session execution failed.",
		};
	}

	// ── Granular Pipeline Steps ────────────────────────────────────
	// For advanced use cases where you want to inspect intermediate state.

	/**
	 * Step 1: Parse a user prompt into a structured intent.
	 */
	parsePrompt(prompt: string): ParsedIntent {
		return parseIntent(prompt);
	}

	/**
	 * Step 2: Analyze the current timeline state.
	 */
	analyzeCurrentTimeline(editor: EditorCore): TimelineMetrics {
		return analyzeTimeline(editor);
	}

	/**
	 * Step 3: Generate an edit plan from intent + metrics.
	 */
	plan(intent: ParsedIntent, metrics: TimelineMetrics): EditPlan {
		return generateEditPlan(intent, metrics);
	}

	/**
	 * Step 4: Map a plan to timeline commands.
	 */
	mapCommands(
		editPlan: EditPlan,
		editor: EditorCore,
	): TimelineCommandUnion[] {
		return mapPlanToCommands(editPlan, editor);
	}

	/**
	 * Step 5: Validate commands before execution.
	 */
	validate(
		commands: TimelineCommandUnion[],
		editor: EditorCore,
	): ValidationResult {
		return validateCommands(commands, editor);
	}

	/**
	 * Step 6: Execute a session that's been prepared with plan + commands.
	 */
	executeSession(
		sessionId: string,
		editor: EditorCore,
	): boolean {
		return this.sessionManager.executeSession(sessionId, editor);
	}

	// ── Session Management ─────────────────────────────────────────

	/**
	 * Rollback/reject a completed AI editing session.
	 * Undoes all changes from that session in one step.
	 */
	rollback(sessionId: string, editor: EditorCore): boolean {
		return this.sessionManager.rollbackSession(sessionId, editor);
	}

	/**
	 * Get a session by ID.
	 */
	getSession(sessionId: string): AiEditingSession | undefined {
		return this.sessionManager.getSession(sessionId);
	}

	/**
	 * Get all AI editing sessions.
	 */
	getAllSessions(): AiEditingSession[] {
		return this.sessionManager.getAllSessions();
	}

	/**
	 * Remove a session from history.
	 */
	removeSession(sessionId: string): void {
		this.sessionManager.removeSession(sessionId);
	}

	/**
	 * Clear all sessions.
	 */
	clear(): void {
		this.sessionManager.clear();
	}
}
