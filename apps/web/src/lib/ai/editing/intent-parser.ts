/**
 * Intent Parser — Converts vague user prompts into structured editing intents.
 *
 * This is a local (non-LLM) classifier that handles common editing patterns.
 * For truly ambiguous prompts, it returns a "custom" intent that the LLM
 * can expand into a full edit plan via the planner.
 */

import type { IntentType, ParsedIntent } from "./types";

interface IntentPattern {
	type: IntentType;
	keywords: string[];
	defaultParameters: Record<string, unknown>;
	defaultAggressiveness: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
	{
		type: "trim_silence",
		keywords: [
			"cut silence",
			"remove silence",
			"trim silence",
			"dead air",
			"remove pauses",
			"cut pauses",
			"remove gaps",
			"trim gaps",
			"tighten",
		],
		defaultParameters: { threshold: 0.3 },
		defaultAggressiveness: 0.5,
	},
	{
		type: "reduce_clip_length",
		keywords: [
			"shorter clips",
			"faster cuts",
			"quick cuts",
			"reduce clip",
			"snappy",
			"punchier",
			"faster pacing",
			"speed up pace",
		],
		defaultParameters: { targetAvgLength: 2.5 },
		defaultAggressiveness: 0.6,
	},
	{
		type: "increase_engagement",
		keywords: [
			"more engaging",
			"make engaging",
			"more dynamic",
			"more energy",
			"more exciting",
			"more interesting",
			"liven up",
			"spice up",
			"boost engagement",
		],
		defaultParameters: {},
		defaultAggressiveness: 0.7,
	},
	{
		type: "insert_contextual_broll",
		keywords: [
			"add b-roll",
			"b-roll",
			"broll",
			"insert footage",
			"overlay footage",
			"cutaway",
			"cut away",
			"visual variety",
		],
		defaultParameters: { keywords: [] },
		defaultAggressiveness: 0.5,
	},
	{
		type: "kinetic_captions",
		keywords: [
			"kinetic caption",
			"dynamic caption",
			"animated caption",
			"word by word",
			"karaoke caption",
			"caption style",
			"animated text",
			"pop text",
			"dynamic subtitles",
		],
		defaultParameters: { style: "kinetic" },
		defaultAggressiveness: 0.5,
	},
	{
		type: "apply_style_profile",
		keywords: [
			"like capcut",
			"like tiktok",
			"cinematic",
			"make it cinematic",
			"documentary style",
			"youtube style",
			"podcast style",
			"corporate style",
			"reel style",
			"short form",
			"shorts style",
		],
		defaultParameters: {},
		defaultAggressiveness: 0.6,
	},
	{
		type: "duration_constraint",
		keywords: [
			"shorten to",
			"make it",
			"trim to",
			"fit in",
			"under",
			"seconds long",
			"minute long",
			"30 sec",
			"60 sec",
			"15 sec",
		],
		defaultParameters: {},
		defaultAggressiveness: 0.5,
	},
	{
		type: "add_punch_zoom",
		keywords: [
			"punch zoom",
			"zoom in",
			"zoom effect",
			"emphasis zoom",
			"zoom on",
			"punch in",
			"add zoom",
		],
		defaultParameters: { count: 5, scale: 1.05 },
		defaultAggressiveness: 0.5,
	},
	{
		type: "insert_music",
		keywords: [
			"add music",
			"background music",
			"insert music",
			"add a beat",
			"add soundtrack",
			"music track",
			"background audio",
		],
		defaultParameters: { style: "upbeat" },
		defaultAggressiveness: 0.3,
	},
	{
		type: "add_transitions",
		keywords: [
			"add transition",
			"transitions",
			"cross fade",
			"crossfade",
			"dissolve",
			"fade between",
			"smooth transition",
			"whip transition",
		],
		defaultParameters: { style: "dissolve", duration: 0.5 },
		defaultAggressiveness: 0.4,
	},
	{
		type: "speed_ramp",
		keywords: [
			"speed ramp",
			"slow motion",
			"slow mo",
			"time remap",
			"speed up",
			"fast forward",
			"slow down",
		],
		defaultParameters: {},
		defaultAggressiveness: 0.5,
	},
	{
		type: "add_text_overlay",
		keywords: [
			"add title",
			"add text",
			"text overlay",
			"lower third",
			"name tag",
			"intro text",
			"outro text",
			"heading",
		],
		defaultParameters: {},
		defaultAggressiveness: 0.3,
	},
	{
		type: "adjust_audio_levels",
		keywords: [
			"audio levels",
			"volume",
			"louder",
			"quieter",
			"audio mix",
			"normalize audio",
			"duck music",
			"audio ducking",
			"balance audio",
		],
		defaultParameters: {},
		defaultAggressiveness: 0.4,
	},
	{
		type: "color_grade",
		keywords: [
			"color grade",
			"color correct",
			"warm tones",
			"cool tones",
			"desaturate",
			"saturate",
			"contrast",
			"brightness",
			"vintage look",
			"film look",
		],
		defaultParameters: {},
		defaultAggressiveness: 0.4,
	},
];

/**
 * Extract a target duration in seconds from user prompt.
 * Handles "30 seconds", "1 minute", "2 min", "90s", etc.
 */
function extractDurationTarget(prompt: string): number | null {
	const secMatch = prompt.match(
		/(\d+)\s*(?:seconds?|secs?|s)\b/i,
	);
	if (secMatch) {
		return Number.parseInt(secMatch[1], 10);
	}

	const minMatch = prompt.match(
		/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/i,
	);
	if (minMatch) {
		return Number.parseFloat(minMatch[1]) * 60;
	}

	return null;
}

/**
 * Extract a style profile name from user prompt.
 */
function extractStyleProfile(prompt: string): string | null {
	const lower = prompt.toLowerCase();

	const styleMap: Record<string, string> = {
		capcut: "reel",
		tiktok: "reel",
		reels: "reel",
		shorts: "reel",
		"short form": "reel",
		youtube: "youtube",
		podcast: "podcast",
		documentary: "documentary",
		corporate: "corporate",
		cinematic: "cinematic",
		"film look": "cinematic",
	};

	for (const [keyword, profile] of Object.entries(styleMap)) {
		if (lower.includes(keyword)) {
			return profile;
		}
	}

	return null;
}

/**
 * Assess aggressiveness from qualifiers in the prompt.
 */
function extractAggressiveness(prompt: string, base: number): number {
	const lower = prompt.toLowerCase();
	let modifier = 0;

	const boostWords = ["very", "extremely", "super", "really", "much more", "way more", "aggressively", "heavily"];
	const reduceWords = ["slightly", "a bit", "a little", "subtly", "gently", "mildly", "lightly"];

	for (const word of boostWords) {
		if (lower.includes(word)) {
			modifier += 0.2;
			break;
		}
	}

	for (const word of reduceWords) {
		if (lower.includes(word)) {
			modifier -= 0.2;
			break;
		}
	}

	return Math.max(0.1, Math.min(1.0, base + modifier));
}

/**
 * Parse a user prompt into a structured intent.
 *
 * Uses keyword matching for common patterns. Returns "custom"
 * intent type for prompts that don't match known patterns —
 * the LLM planner handles those.
 */
export function parseIntent(prompt: string): ParsedIntent {
	const lower = prompt.toLowerCase().trim();

	let bestMatch: IntentPattern | null = null;
	let bestScore = 0;

	for (const pattern of INTENT_PATTERNS) {
		let score = 0;
		for (const keyword of pattern.keywords) {
			if (lower.includes(keyword)) {
				// Longer keyword matches are more specific
				score += keyword.length;
			}
		}

		if (score > bestScore) {
			bestScore = score;
			bestMatch = pattern;
		}
	}

	if (!bestMatch || bestScore === 0) {
		return {
			type: "custom",
			confidence: 0.3,
			parameters: {},
			rawPrompt: prompt,
			aggressiveness: 0.5,
		};
	}

	const parameters = { ...bestMatch.defaultParameters };
	const aggressiveness = extractAggressiveness(
		prompt,
		bestMatch.defaultAggressiveness,
	);

	// Enrich parameters based on intent type
	if (bestMatch.type === "duration_constraint") {
		const target = extractDurationTarget(prompt);
		if (target !== null) {
			parameters.targetDuration = target;
		}
	}

	if (bestMatch.type === "apply_style_profile") {
		const profile = extractStyleProfile(prompt);
		if (profile) {
			parameters.profileName = profile;
		}
	}

	// Calculate confidence based on keyword match quality
	const maxPossibleScore = bestMatch.keywords.reduce(
		(sum, keyword) => sum + keyword.length,
		0,
	);
	const confidence = Math.min(0.95, 0.4 + (bestScore / maxPossibleScore) * 0.55);

	return {
		type: bestMatch.type,
		confidence,
		parameters,
		rawPrompt: prompt,
		style: extractStyleProfile(prompt) ?? undefined,
		aggressiveness,
	};
}
