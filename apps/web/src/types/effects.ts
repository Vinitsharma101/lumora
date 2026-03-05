/**
 * Effect and Transition Type Definitions
 *
 * Central type system for all video effects and transitions.
 * Effects modify individual clips; transitions blend between clips or handle in/out.
 */

// ── Effect Categories ──

export const EFFECT_CATEGORIES = {
	color: "Color & Cinematic",
	vfx: "Visual Effects",
	motion: "Motion Effects",
	ai: "AI Smart Effects",
	pro: "Pro Effects",
} as const;

export type EffectCategory = keyof typeof EFFECT_CATEGORIES;

// ── Transition Categories ──

export const TRANSITION_CATEGORIES = {
	basic: "Basic",
	cinematic: "Cinematic",
	viral: "Viral / Social Media",
	beat: "Beat Sync",
} as const;

export type TransitionCategory = keyof typeof TRANSITION_CATEGORIES;

// ── Effect Definition ──

export interface EffectDefinition {
	id: string;
	type: string;
	name: string;
	category: EffectCategory;
	description: string;
	icon: string;
	defaultIntensity: number;
	minIntensity: number;
	maxIntensity: number;
	parameters?: EffectParameter[];
}

export interface EffectParameter {
	key: string;
	label: string;
	type: "number" | "color" | "select";
	defaultValue: number | string;
	min?: number;
	max?: number;
	step?: number;
	options?: { label: string; value: string }[];
}

// ── Applied Effect (on a timeline element) ──

export interface AppliedEffect {
	id: string;
	type: string;
	intensity: number;
	parameters?: Record<string, number | string>;
}

// ── Transition Definition ──

export interface TransitionDefinition {
	id: string;
	type: string;
	name: string;
	category: TransitionCategory;
	description: string;
	icon: string;
	defaultDuration: number;
	minDuration: number;
	maxDuration: number;
	supportedDirections: ("in" | "out" | "both")[];
}

// ── Applied Transition (on a timeline element) ──

export interface AppliedTransition {
	id: string;
	type: string;
	duration: number;
	direction: "in" | "out";
	easing?: EasingType;
}

// ── Easing ──

export const EASING_TYPES = {
	linear: "Linear",
	easeIn: "Ease In",
	easeOut: "Ease Out",
	easeInOut: "Ease In Out",
	easeInCubic: "Ease In Cubic",
	easeOutCubic: "Ease Out Cubic",
	easeInOutCubic: "Ease In Out Cubic",
	easeInBack: "Ease In Back",
	easeOutBack: "Ease Out Back",
	easeInOutBack: "Ease In Out Back",
	bounce: "Bounce",
} as const;

export type EasingType = keyof typeof EASING_TYPES;

// ── AI Editing Modes ──

export const AI_EDITING_MODES = {
	cinematic: "Cinematic Mode",
	viral: "Viral Mode",
	documentary: "Documentary Mode",
	musicVideo: "Music Video Mode",
	travel: "Travel Mode",
} as const;

export type AIEditingMode = keyof typeof AI_EDITING_MODES;

export interface AIEditingModeConfig {
	id: AIEditingMode;
	name: string;
	description: string;
	effects: string[];
	transitions: string[];
	colorGrade: string;
	beatSync: boolean;
}

// ── Beat Detection ──

export interface BeatMarker {
	time: number;
	strength: number;
	type: "beat" | "downbeat" | "accent";
}

export interface BeatSyncConfig {
	sensitivity: number;
	minInterval: number;
	effects: string[];
	transitions: string[];
}
