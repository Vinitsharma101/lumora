/**
 * AI → Timeline Command Mapping System
 *
 * The brain-to-hands bridge that turns natural language into
 * deterministic, validated, reversible timeline commands.
 *
 * Usage:
 *   const orchestrator = new AiEditingOrchestrator();
 *   const result = orchestrator.execute("Cut all silences", editor);
 *   if (result.canUndo) orchestrator.rollback(result.session.id, editor);
 */

export { AiEditingOrchestrator } from "./orchestrator";
export type {
	AiEditResult,
	AiEditingSession,
	ParsedIntent,
	EditPlan,
	TimelineMetrics,
} from "./orchestrator";

export { parseIntent } from "./intent-parser";
export { analyzeTimeline } from "./timeline-analyzer";
export { generateEditPlan } from "./edit-planner";
export { mapPlanToCommands } from "./command-mapper";
export { validateCommands } from "./command-validator";
export { AiSessionManager } from "./ai-editing-session";
export {
	getStyleProfile,
	getStyleProfileNames,
	getStyleProfileSummary,
} from "./style-profiles";

export type {
	IntentType,
	PlanAction,
	PlanActionType,
	TimelineCommandUnion,
	TimelineCommandType,
	ValidationResult,
	ValidationError,
	ValidationWarning,
	SessionStatus,
	FrontendStyleProfile,
	SilenceSegment,
	GapSegment,
} from "./types";
