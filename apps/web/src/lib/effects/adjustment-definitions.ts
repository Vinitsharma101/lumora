/**
 * Adjustment Definitions
 *
 * Per-property visual adjustments for clips.
 * Unlike Filters (opinionated presets), Adjustments are individual, fine-grained
 * sliders that map directly to CSS filter properties.
 *
 * Categories:
 *   light  — Exposure, Brightness, Contrast, Highlights, Shadows, Whites, Blacks
 *   color  — Temperature, Tint, Saturation, Vibrance
 *   detail — Sharpness, Vignette, Fade
 */

export const ADJUSTMENT_CATEGORIES = {
	light: "Light",
	color: "Color",
	detail: "Detail",
} as const;

export type AdjustmentCategory = keyof typeof ADJUSTMENT_CATEGORIES;

export interface AdjustmentDefinition {
	id: string;
	type: string;
	name: string;
	icon: string;
	description: string;
	category: AdjustmentCategory;
	/** Neutral / pass-through value (e.g. 0 for bipolar, 100 for multiplier-based) */
	defaultValue: number;
	min: number;
	max: number;
	step: number;
	unit: string;
}

// ── Light Adjustments ──

const lightAdjustments: AdjustmentDefinition[] = [
	{
		id: "adjust-exposure",
		type: "adjust-exposure",
		name: "Exposure",
		icon: "☀️",
		description: "Overall exposure compensation",
		category: "light",
		defaultValue: 0,
		min: -100,
		max: 100,
		step: 1,
		unit: "",
	},
	{
		id: "adjust-brightness",
		type: "adjust-brightness",
		name: "Brightness",
		icon: "🔆",
		description: "Adjust overall brightness",
		category: "light",
		defaultValue: 0,
		min: -100,
		max: 100,
		step: 1,
		unit: "",
	},
	{
		id: "adjust-contrast",
		type: "adjust-contrast",
		name: "Contrast",
		icon: "🌓",
		description: "Adjust tonal contrast",
		category: "light",
		defaultValue: 0,
		min: -100,
		max: 100,
		step: 1,
		unit: "",
	},
	{
		id: "adjust-highlights",
		type: "adjust-highlights",
		name: "Highlights",
		icon: "🌤️",
		description: "Recover or boost bright areas",
		category: "light",
		defaultValue: 0,
		min: -100,
		max: 100,
		step: 1,
		unit: "",
	},
	{
		id: "adjust-shadows",
		type: "adjust-shadows",
		name: "Shadows",
		icon: "🌑",
		description: "Lift or crush dark areas",
		category: "light",
		defaultValue: 0,
		min: -100,
		max: 100,
		step: 1,
		unit: "",
	},
	{
		id: "adjust-whites",
		type: "adjust-whites",
		name: "Whites",
		icon: "⬜",
		description: "Set the white clipping point",
		category: "light",
		defaultValue: 0,
		min: -100,
		max: 100,
		step: 1,
		unit: "",
	},
	{
		id: "adjust-blacks",
		type: "adjust-blacks",
		name: "Blacks",
		icon: "⬛",
		description: "Set the black clipping point",
		category: "light",
		defaultValue: 0,
		min: -100,
		max: 100,
		step: 1,
		unit: "",
	},
];

// ── Color Adjustments ──

const colorAdjustments: AdjustmentDefinition[] = [
	{
		id: "adjust-temperature",
		type: "adjust-temperature",
		name: "Temperature",
		icon: "🌡️",
		description: "Shift color temperature (cool ↔ warm)",
		category: "color",
		defaultValue: 0,
		min: -100,
		max: 100,
		step: 1,
		unit: "",
	},
	{
		id: "adjust-tint",
		type: "adjust-tint",
		name: "Tint",
		icon: "🎨",
		description: "Shift green ↔ magenta tint",
		category: "color",
		defaultValue: 0,
		min: -100,
		max: 100,
		step: 1,
		unit: "",
	},
	{
		id: "adjust-saturation",
		type: "adjust-saturation",
		name: "Saturation",
		icon: "🌈",
		description: "Adjust color saturation",
		category: "color",
		defaultValue: 0,
		min: -100,
		max: 100,
		step: 1,
		unit: "",
	},
	{
		id: "adjust-vibrance",
		type: "adjust-vibrance",
		name: "Vibrance",
		icon: "💐",
		description: "Boost muted colors while protecting skin tones",
		category: "color",
		defaultValue: 0,
		min: -100,
		max: 100,
		step: 1,
		unit: "",
	},
];

// ── Detail Adjustments ──

const detailAdjustments: AdjustmentDefinition[] = [
	{
		id: "adjust-sharpness",
		type: "adjust-sharpness",
		name: "Sharpness",
		icon: "🔍",
		description: "Enhance edge definition",
		category: "detail",
		defaultValue: 0,
		min: 0,
		max: 100,
		step: 1,
		unit: "",
	},
	{
		id: "adjust-vignette",
		type: "adjust-vignette",
		name: "Vignette",
		icon: "🔲",
		description: "Darken edges for a cinematic frame",
		category: "detail",
		defaultValue: 0,
		min: 0,
		max: 100,
		step: 1,
		unit: "",
	},
	{
		id: "adjust-fade",
		type: "adjust-fade",
		name: "Fade",
		icon: "🌫️",
		description: "Lift blacks for a faded film look",
		category: "detail",
		defaultValue: 0,
		min: 0,
		max: 100,
		step: 1,
		unit: "",
	},
];

// ── Registry ──

export const ALL_ADJUSTMENTS: AdjustmentDefinition[] = [
	...lightAdjustments,
	...colorAdjustments,
	...detailAdjustments,
];

export const ADJUSTMENT_MAP = new Map(ALL_ADJUSTMENTS.map((a) => [a.id, a]));

export function getAdjustmentById(id: string): AdjustmentDefinition | undefined {
	return ADJUSTMENT_MAP.get(id);
}

export function getAdjustmentsByCategory(category: AdjustmentCategory): AdjustmentDefinition[] {
	return ALL_ADJUSTMENTS.filter((a) => a.category === category);
}

/**
 * Build a CSS filter string from an array of adjustment effects.
 *
 * Each adjustment effect has:
 *   - type: "adjust-*"
 *   - intensity: a value in the adjustment's [min, max] range
 *
 * The value is mapped from the slider range to the appropriate CSS filter range.
 * A value of 0 (the default) means "no change" and produces pass-through CSS.
 */
export function buildAdjustmentFilterCSS(
	adjustments: Array<{ type: string; intensity?: number }>,
): string {
	const parts: string[] = [];

	for (const adj of adjustments) {
		const value = adj.intensity ?? 0;
		if (value === 0) continue; // Neutral — no effect

		switch (adj.type) {
			case "adjust-exposure": {
				// Map [-100, 100] → brightness [50%, 200%]. 0 → 100%.
				const brightness = 100 + value;
				parts.push(`brightness(${brightness}%)`);
				break;
			}
			case "adjust-brightness": {
				// Map [-100, 100] → brightness [50%, 150%]. 0 → 100%.
				const brightness = 100 + value * 0.5;
				parts.push(`brightness(${brightness}%)`);
				break;
			}
			case "adjust-contrast": {
				// Map [-100, 100] → contrast [50%, 200%]. 0 → 100%.
				const contrast = 100 + value;
				parts.push(`contrast(${contrast}%)`);
				break;
			}
			case "adjust-highlights": {
				// Approximate highlights as brightness + slight contrast shift
				// Positive: lighten bright areas, Negative: darken them
				const brightness = 100 + value * 0.3;
				const contrast = 100 + value * 0.15;
				parts.push(`brightness(${brightness}%)`);
				parts.push(`contrast(${contrast}%)`);
				break;
			}
			case "adjust-shadows": {
				// Approximate shadows lift/crush via brightness + contrast
				const brightness = 100 + value * 0.25;
				const contrast = 100 - value * 0.1;
				parts.push(`brightness(${brightness}%)`);
				parts.push(`contrast(${contrast}%)`);
				break;
			}
			case "adjust-whites": {
				// Push whites up or down
				const brightness = 100 + value * 0.2;
				parts.push(`brightness(${brightness}%)`);
				break;
			}
			case "adjust-blacks": {
				// Push blacks up (fade) or down (crush)
				const contrast = 100 + value * 0.3;
				parts.push(`contrast(${contrast}%)`);
				break;
			}
			case "adjust-temperature": {
				// Map [-100, 100] → hue-rotate [-30deg, 30deg] + sepia touch for warmth
				if (value > 0) {
					// Warm: add sepia + slight hue shift
					const sepia = value * 0.2;
					const hue = value * -0.05;
					parts.push(`sepia(${sepia}%)`);
					parts.push(`hue-rotate(${hue}deg)`);
				} else {
					// Cool: hue-rotate towards blue
					const hue = value * 0.3;
					parts.push(`hue-rotate(${hue}deg)`);
				}
				break;
			}
			case "adjust-tint": {
				// Map [-100, 100] → hue-rotate [-20deg, 20deg]
				const hue = value * 0.2;
				parts.push(`hue-rotate(${hue}deg)`);
				break;
			}
			case "adjust-saturation": {
				// Map [-100, 100] → saturate [0%, 200%]. 0 → 100%.
				const saturate = 100 + value;
				parts.push(`saturate(${saturate}%)`);
				break;
			}
			case "adjust-vibrance": {
				// Vibrance is a gentler saturation boost
				const saturate = 100 + value * 0.6;
				parts.push(`saturate(${saturate}%)`);
				break;
			}
			case "adjust-sharpness": {
				// Pseudo-sharpen via contrast boost. Range [0, 100] → contrast [100%, 130%].
				const contrast = 100 + value * 0.3;
				parts.push(`contrast(${contrast}%)`);
				break;
			}
			case "adjust-fade": {
				// Lift blacks = reduce contrast + boost brightness. Range [0, 100].
				const contrast = 100 - value * 0.3;
				const brightness = 100 + value * 0.15;
				parts.push(`contrast(${contrast}%)`);
				parts.push(`brightness(${brightness}%)`);
				break;
			}
			// Vignette is handled as an overlay effect, not a CSS filter
		}
	}

	return parts.join(" ");
}
