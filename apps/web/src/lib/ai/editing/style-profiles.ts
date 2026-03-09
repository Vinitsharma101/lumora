/**
 * Frontend Style Profiles — Editing presets that the AI uses as targets.
 *
 * When a user says "make it like CapCut" or "cinematic style", the AI
 * loads the matching profile and generates commands to match.
 * These are simplified frontend versions of the backend profiles.
 */

import type { FrontendStyleProfile } from "./types";

const STYLE_PROFILES: Record<string, FrontendStyleProfile> = {
	reel: {
		name: "reel",
		description:
			"Short-form social (TikTok, Reels, Shorts). High energy, fast cuts, kinetic captions.",
		targetAvgClipLength: 2.2,
		captionStyle: "kinetic",
		zoomFrequency: 0.4,
		transitionStyle: "whip",
		pacingCutsPerMinute: [15, 30],
		musicVolume: 0.4,
		silenceThreshold: 0.25,
		punchZoomScale: 1.08,
		targetAspectRatio: "9:16",
		targetFps: 30,
	},
	youtube: {
		name: "youtube",
		description:
			"Long-form YouTube content. Balanced pacing, clear captions, B-roll engagement.",
		targetAvgClipLength: 5.0,
		captionStyle: "basic",
		zoomFrequency: 0.2,
		transitionStyle: "cut",
		pacingCutsPerMinute: [8, 15],
		musicVolume: 0.3,
		silenceThreshold: 0.4,
		punchZoomScale: 1.05,
		targetAspectRatio: "16:9",
		targetFps: 30,
	},
	podcast: {
		name: "podcast",
		description:
			"Podcast/interview format. Slow pacing, minimal effects, speech priority.",
		targetAvgClipLength: 10.0,
		captionStyle: "minimal",
		zoomFrequency: 0.05,
		transitionStyle: "dissolve",
		pacingCutsPerMinute: [3, 6],
		musicVolume: 0.15,
		silenceThreshold: 0.8,
		punchZoomScale: 1.02,
		targetAspectRatio: "16:9",
		targetFps: 30,
	},
	documentary: {
		name: "documentary",
		description:
			"Documentary/narrative. Cinematic pacing, atmospheric audio, thoughtful transitions.",
		targetAvgClipLength: 6.0,
		captionStyle: "minimal",
		zoomFrequency: 0.1,
		transitionStyle: "dissolve",
		pacingCutsPerMinute: [4, 8],
		musicVolume: 0.35,
		silenceThreshold: 0.6,
		punchZoomScale: 1.04,
		targetAspectRatio: "16:9",
		targetFps: 24,
	},
	corporate: {
		name: "corporate",
		description:
			"Corporate/presentation. Clean, professional, minimal effects.",
		targetAvgClipLength: 6.0,
		captionStyle: "basic",
		zoomFrequency: 0.05,
		transitionStyle: "fade",
		pacingCutsPerMinute: [5, 10],
		musicVolume: 0.2,
		silenceThreshold: 0.5,
		punchZoomScale: 1.03,
		targetAspectRatio: "16:9",
		targetFps: 30,
	},
	cinematic: {
		name: "cinematic",
		description:
			"Cinematic/film. Dramatic pacing, rich visuals, bold transitions.",
		targetAvgClipLength: 4.5,
		captionStyle: "none",
		zoomFrequency: 0.15,
		transitionStyle: "dissolve",
		pacingCutsPerMinute: [6, 12],
		musicVolume: 0.4,
		silenceThreshold: 0.4,
		punchZoomScale: 1.06,
		targetAspectRatio: "16:9",
		targetFps: 24,
	},
};

/**
 * Get a style profile by name. Falls back to "youtube" for unknown names.
 */
export function getStyleProfile(name: string): FrontendStyleProfile {
	return STYLE_PROFILES[name] ?? STYLE_PROFILES.youtube;
}

/**
 * Get all available profile names.
 */
export function getStyleProfileNames(): string[] {
	return Object.keys(STYLE_PROFILES);
}

/**
 * Get a summary of all profiles for display or LLM context.
 */
export function getStyleProfileSummary(): string {
	const lines: string[] = [];
	for (const profile of Object.values(STYLE_PROFILES)) {
		lines.push(
			`- ${profile.name}: ${profile.description} (cuts/min: ${profile.pacingCutsPerMinute[0]}-${profile.pacingCutsPerMinute[1]}, aspect: ${profile.targetAspectRatio})`,
		);
	}
	return lines.join("\n");
}
