/**
 * AI → Timeline Command Mapping — Core Types
 *
 * This module defines the full pipeline from user intent to
 * deterministic timeline commands. The AI never directly mutates
 * timeline state — it only produces validated, reversible commands.
 *
 * Pipeline:
 *   User Prompt → Intent → Edit Plan → Commands → Validation → Execute
 */

// ── Intent Types ───────────────────────────────────────────────────

export const INTENT_TYPES = {
	trim_silence: "trim_silence",
	reduce_clip_length: "reduce_clip_length",
	increase_engagement: "increase_engagement",
	insert_contextual_broll: "insert_contextual_broll",
	kinetic_captions: "kinetic_captions",
	apply_style_profile: "apply_style_profile",
	duration_constraint: "duration_constraint",
	add_punch_zoom: "add_punch_zoom",
	insert_music: "insert_music",
	add_transitions: "add_transitions",
	speed_ramp: "speed_ramp",
	reorder_clips: "reorder_clips",
	add_text_overlay: "add_text_overlay",
	adjust_audio_levels: "adjust_audio_levels",
	color_grade: "color_grade",
	custom: "custom",
} as const;

export type IntentType = (typeof INTENT_TYPES)[keyof typeof INTENT_TYPES];

export interface ParsedIntent {
	type: IntentType;
	confidence: number;
	parameters: Record<string, unknown>;
	rawPrompt: string;
	style?: string;
	aggressiveness?: number;
}

// ── Timeline Intelligence Snapshot ─────────────────────────────────

export interface SilenceSegment {
	start: number;
	end: number;
	duration: number;
	trackId: string;
	elementId: string;
}

export interface TimelineMetrics {
	duration: number;
	avgClipLength: number;
	medianClipLength: number;
	minClipLength: number;
	maxClipLength: number;
	clipCount: number;
	trackCount: number;
	silenceSegments: SilenceSegment[];
	totalSilenceDuration: number;
	energyScore: number;
	pacingScore: number;
	captionCoverage: number;
	hasMusic: boolean;
	hasCaptions: boolean;
	elementsByType: Record<string, number>;
	gapSegments: GapSegment[];
}

export interface GapSegment {
	start: number;
	end: number;
	duration: number;
	trackId: string;
}

// ── Edit Plan ──────────────────────────────────────────────────────

export const PLAN_ACTION_TYPES = {
	trim_silence: "trim_silence",
	cut_clip: "cut_clip",
	delete_segment: "delete_segment",
	reduce_avg_clip_length: "reduce_avg_clip_length",
	add_punch_zoom: "add_punch_zoom",
	insert_music: "insert_music",
	insert_broll: "insert_broll",
	add_caption: "add_caption",
	add_text_overlay: "add_text_overlay",
	add_transition: "add_transition",
	adjust_speed: "adjust_speed",
	adjust_volume: "adjust_volume",
	move_element: "move_element",
	update_element: "update_element",
	apply_effect: "apply_effect",
	constrain_duration: "constrain_duration",
} as const;

export type PlanActionType =
	(typeof PLAN_ACTION_TYPES)[keyof typeof PLAN_ACTION_TYPES];

export interface PlanAction {
	type: PlanActionType;
	priority: number;
	parameters: Record<string, unknown>;
	reasoning?: string;
}

export interface EditPlan {
	id: string;
	intent: ParsedIntent;
	actions: PlanAction[];
	estimatedChanges: number;
	metrics: TimelineMetrics;
	createdAt: number;
}

// ── Command Types ──────────────────────────────────────────────────

export const TIMELINE_COMMAND_TYPES = {
	CUT: "CUT",
	TRIM: "TRIM",
	DELETE: "DELETE",
	INSERT_ELEMENT: "INSERT_ELEMENT",
	MOVE_ELEMENT: "MOVE_ELEMENT",
	UPDATE_ELEMENT: "UPDATE_ELEMENT",
	UPDATE_DURATION: "UPDATE_DURATION",
	ADD_TRACK: "ADD_TRACK",
	ADD_EFFECT: "ADD_EFFECT",
	ADD_TRANSITION: "ADD_TRANSITION",
	SPLIT: "SPLIT",
	UPDATE_VOLUME: "UPDATE_VOLUME",
} as const;

export type TimelineCommandType =
	(typeof TIMELINE_COMMAND_TYPES)[keyof typeof TIMELINE_COMMAND_TYPES];

export interface BaseTimelineCommand {
	type: TimelineCommandType;
	id: string;
}

export interface CutCommand extends BaseTimelineCommand {
	type: "CUT";
	trackId: string;
	elementId: string;
	atTime: number;
}

export interface TrimCommand extends BaseTimelineCommand {
	type: "TRIM";
	trackId: string;
	elementId: string;
	trimStart?: number;
	trimEnd?: number;
}

export interface DeleteCommand extends BaseTimelineCommand {
	type: "DELETE";
	trackId: string;
	elementId: string;
}

export interface InsertElementCommand extends BaseTimelineCommand {
	type: "INSERT_ELEMENT";
	element: Record<string, unknown>;
	placement: { mode: "auto" } | { mode: "explicit"; trackId: string };
}

export interface MoveElementCommand extends BaseTimelineCommand {
	type: "MOVE_ELEMENT";
	trackId: string;
	elementId: string;
	newStartTime: number;
}

export interface UpdateElementCommand extends BaseTimelineCommand {
	type: "UPDATE_ELEMENT";
	trackId: string;
	elementId: string;
	updates: Record<string, unknown>;
}

export interface UpdateDurationCommand extends BaseTimelineCommand {
	type: "UPDATE_DURATION";
	trackId: string;
	elementId: string;
	duration: number;
}

export interface AddTrackCommand extends BaseTimelineCommand {
	type: "ADD_TRACK";
	trackType: string;
}

export interface AddEffectCommand extends BaseTimelineCommand {
	type: "ADD_EFFECT";
	trackId: string;
	elementId: string;
	effect: {
		type: string;
		intensity?: number;
		[key: string]: unknown;
	};
}

export interface AddTransitionCommand extends BaseTimelineCommand {
	type: "ADD_TRANSITION";
	trackId: string;
	elementId: string;
	transition: {
		type: string;
		duration: number;
		direction: "in" | "out";
	};
}

export interface SplitCommand extends BaseTimelineCommand {
	type: "SPLIT";
	trackId: string;
	elementId: string;
	splitTime: number;
	retainSide: "both" | "left" | "right";
}

export interface UpdateVolumeCommand extends BaseTimelineCommand {
	type: "UPDATE_VOLUME";
	trackId: string;
	elementId: string;
	volume: number;
}

export type TimelineCommandUnion =
	| CutCommand
	| TrimCommand
	| DeleteCommand
	| InsertElementCommand
	| MoveElementCommand
	| UpdateElementCommand
	| UpdateDurationCommand
	| AddTrackCommand
	| AddEffectCommand
	| AddTransitionCommand
	| SplitCommand
	| UpdateVolumeCommand;

// ── Validation ─────────────────────────────────────────────────────

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
}

export interface ValidationError {
	commandId: string;
	field: string;
	message: string;
}

export interface ValidationWarning {
	commandId: string;
	message: string;
}

// ── AI Editing Session ─────────────────────────────────────────────

export const SESSION_STATUSES = {
	planning: "planning",
	validating: "validating",
	ready: "ready",
	executing: "executing",
	completed: "completed",
	rejected: "rejected",
	rolled_back: "rolled_back",
	failed: "failed",
} as const;

export type SessionStatus =
	(typeof SESSION_STATUSES)[keyof typeof SESSION_STATUSES];

export interface AiEditingSession {
	id: string;
	status: SessionStatus;
	intent: ParsedIntent;
	plan: EditPlan | null;
	commands: TimelineCommandUnion[];
	validation: ValidationResult | null;
	createdAt: number;
	executedAt: number | null;
	error: string | null;
}

// ── Style Profiles (Frontend) ──────────────────────────────────────

export interface FrontendStyleProfile {
	name: string;
	description: string;
	targetAvgClipLength: number;
	captionStyle: "none" | "basic" | "kinetic" | "minimal" | "viral";
	zoomFrequency: number;
	transitionStyle: "cut" | "dissolve" | "whip" | "glitch" | "fade";
	pacingCutsPerMinute: [number, number];
	musicVolume: number;
	silenceThreshold: number;
	punchZoomScale: number;
	targetAspectRatio: string;
	targetFps: number;
}

// ── Orchestrator Result ────────────────────────────────────────────

export interface AiEditResult {
	success: boolean;
	session: AiEditingSession;
	commandsExecuted: number;
	canUndo: boolean;
	validation?: ValidationResult;
	error?: string;
}
