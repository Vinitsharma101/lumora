/**
 * Filter Definitions
 *
 * Dedicated video filters organized by category.
 * Filters are visual presets applied to clips — separate from effects (VFX, motion, AI).
 * Each filter is an opinionated color/look preset with an intensity slider.
 *
 * Categories:
 *   cinematic  — Hollywood film color grading looks
 *   color      — Color & tone adjustments (brightness, contrast, etc.)
 *   camera     — Camera/era style filters (VHS, Polaroid, etc.)
 *   artistic   — AI/creative style filters (Anime, Oil Painting, etc.)
 */

export const FILTER_CATEGORIES = {
	cinematic: "Cinematic",
	color: "Color & Tone",
	camera: "Camera Style",
	artistic: "Artistic",
} as const;

export type FilterCategory = keyof typeof FILTER_CATEGORIES;

export interface FilterDefinition {
	id: string;
	type: string;
	name: string;
	category: FilterCategory;
	description: string;
	icon: string;
	defaultIntensity: number;
	/** CSS filter recipe: maps to engine buildFilterString */
	filterRecipe: FilterRecipeStep[];
}

export interface FilterRecipeStep {
	filter: "brightness" | "contrast" | "saturate" | "sepia" | "grayscale" | "hue-rotate" | "blur" | "invert" | "opacity";
	/** Value is multiplied by intensity. For %-based filters, 100 = normal. */
	value: number;
	unit: "%" | "deg" | "px" | "";
}

// ── Cinematic Filters ──

const cinematicFilters: FilterDefinition[] = [
	{
		id: "filter-teal-orange",
		type: "filter-teal-orange",
		name: "Teal & Orange",
		category: "cinematic",
		description: "Hollywood blockbuster teal & orange color grade",
		icon: "🎬",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "saturate", value: 135, unit: "%" },
			{ filter: "contrast", value: 115, unit: "%" },
			{ filter: "hue-rotate", value: -8, unit: "deg" },
		],
	},
	{
		id: "filter-film-grain",
		type: "filter-film-grain",
		name: "Film Grain",
		category: "cinematic",
		description: "Organic 35mm film grain texture",
		icon: "🎞️",
		defaultIntensity: 0.5,
		filterRecipe: [
			{ filter: "contrast", value: 108, unit: "%" },
			{ filter: "saturate", value: 90, unit: "%" },
			{ filter: "brightness", value: 103, unit: "%" },
		],
	},
	{
		id: "filter-vintage-film",
		type: "filter-vintage-film",
		name: "Vintage Film",
		category: "cinematic",
		description: "Retro vintage film color palette",
		icon: "📼",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "sepia", value: 40, unit: "%" },
			{ filter: "contrast", value: 110, unit: "%" },
			{ filter: "brightness", value: 95, unit: "%" },
			{ filter: "saturate", value: 85, unit: "%" },
		],
	},
	{
		id: "filter-moody-cinema",
		type: "filter-moody-cinema",
		name: "Moody Cinema",
		category: "cinematic",
		description: "Dark, moody cinematic atmosphere",
		icon: "🌑",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "brightness", value: 85, unit: "%" },
			{ filter: "contrast", value: 125, unit: "%" },
			{ filter: "saturate", value: 80, unit: "%" },
			{ filter: "hue-rotate", value: -5, unit: "deg" },
		],
	},
	{
		id: "filter-warm-sunset",
		type: "filter-warm-sunset",
		name: "Warm Sunset",
		category: "cinematic",
		description: "Golden hour warm sunset tones",
		icon: "🌅",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "sepia", value: 30, unit: "%" },
			{ filter: "saturate", value: 140, unit: "%" },
			{ filter: "brightness", value: 110, unit: "%" },
			{ filter: "hue-rotate", value: -10, unit: "deg" },
		],
	},
	{
		id: "filter-cold-nordic",
		type: "filter-cold-nordic",
		name: "Cold Nordic",
		category: "cinematic",
		description: "Icy cold Nordic blue tones",
		icon: "❄️",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "brightness", value: 95, unit: "%" },
			{ filter: "contrast", value: 110, unit: "%" },
			{ filter: "saturate", value: 85, unit: "%" },
			{ filter: "hue-rotate", value: -20, unit: "deg" },
		],
	},
	{
		id: "filter-noir",
		type: "filter-noir",
		name: "Noir",
		category: "cinematic",
		description: "Classic high-contrast black & white",
		icon: "⬛",
		defaultIntensity: 1.0,
		filterRecipe: [
			{ filter: "grayscale", value: 100, unit: "%" },
			{ filter: "contrast", value: 130, unit: "%" },
			{ filter: "brightness", value: 95, unit: "%" },
		],
	},
	{
		id: "filter-blockbuster",
		type: "filter-blockbuster",
		name: "Blockbuster",
		category: "cinematic",
		description: "High-contrast Hollywood blockbuster look",
		icon: "🍿",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "contrast", value: 125, unit: "%" },
			{ filter: "saturate", value: 120, unit: "%" },
			{ filter: "brightness", value: 105, unit: "%" },
		],
	},
	{
		id: "filter-indie-film",
		type: "filter-indie-film",
		name: "Indie Film",
		category: "cinematic",
		description: "Soft, desaturated indie film aesthetic",
		icon: "🎭",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "saturate", value: 75, unit: "%" },
			{ filter: "brightness", value: 105, unit: "%" },
			{ filter: "contrast", value: 95, unit: "%" },
		],
	},
	{
		id: "filter-scifi",
		type: "filter-scifi",
		name: "Sci-Fi",
		category: "cinematic",
		description: "Futuristic sci-fi color palette",
		icon: "🚀",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "hue-rotate", value: -20, unit: "deg" },
			{ filter: "saturate", value: 140, unit: "%" },
			{ filter: "contrast", value: 115, unit: "%" },
		],
	},
];

// ── Color & Tone Filters ──

const colorFilters: FilterDefinition[] = [
	{
		id: "filter-brightness",
		type: "filter-brightness",
		name: "Brighten",
		category: "color",
		description: "Increase overall brightness",
		icon: "☀️",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "brightness", value: 130, unit: "%" },
		],
	},
	{
		id: "filter-darken",
		type: "filter-darken",
		name: "Darken",
		category: "color",
		description: "Decrease overall brightness",
		icon: "🌙",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "brightness", value: 70, unit: "%" },
		],
	},
	{
		id: "filter-high-contrast",
		type: "filter-high-contrast",
		name: "High Contrast",
		category: "color",
		description: "Increase color contrast",
		icon: "🌓",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "contrast", value: 150, unit: "%" },
		],
	},
	{
		id: "filter-low-contrast",
		type: "filter-low-contrast",
		name: "Low Contrast",
		category: "color",
		description: "Soft, flattened contrast",
		icon: "🌫️",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "contrast", value: 75, unit: "%" },
			{ filter: "brightness", value: 110, unit: "%" },
		],
	},
	{
		id: "filter-vibrant",
		type: "filter-vibrant",
		name: "Vibrant",
		category: "color",
		description: "Boost color saturation",
		icon: "🌈",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "saturate", value: 160, unit: "%" },
		],
	},
	{
		id: "filter-desaturated",
		type: "filter-desaturated",
		name: "Desaturated",
		category: "color",
		description: "Muted, low saturation look",
		icon: "🩶",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "saturate", value: 40, unit: "%" },
		],
	},
	{
		id: "filter-warm-tone",
		type: "filter-warm-tone",
		name: "Warm Tone",
		category: "color",
		description: "Warm color temperature shift",
		icon: "🔥",
		defaultIntensity: 0.5,
		filterRecipe: [
			{ filter: "sepia", value: 20, unit: "%" },
			{ filter: "saturate", value: 115, unit: "%" },
			{ filter: "brightness", value: 105, unit: "%" },
		],
	},
	{
		id: "filter-cool-tone",
		type: "filter-cool-tone",
		name: "Cool Tone",
		category: "color",
		description: "Cool blue color temperature",
		icon: "💎",
		defaultIntensity: 0.5,
		filterRecipe: [
			{ filter: "hue-rotate", value: -15, unit: "deg" },
			{ filter: "saturate", value: 110, unit: "%" },
			{ filter: "brightness", value: 97, unit: "%" },
		],
	},
	{
		id: "filter-hdr",
		type: "filter-hdr",
		name: "HDR",
		category: "color",
		description: "High dynamic range enhancement",
		icon: "🌟",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "contrast", value: 130, unit: "%" },
			{ filter: "saturate", value: 125, unit: "%" },
			{ filter: "brightness", value: 108, unit: "%" },
		],
	},
	{
		id: "filter-faded",
		type: "filter-faded",
		name: "Faded",
		category: "color",
		description: "Washed-out, faded aesthetic",
		icon: "🌁",
		defaultIntensity: 0.5,
		filterRecipe: [
			{ filter: "contrast", value: 80, unit: "%" },
			{ filter: "brightness", value: 115, unit: "%" },
			{ filter: "saturate", value: 75, unit: "%" },
		],
	},
];

// ── Camera Style Filters ──

const cameraFilters: FilterDefinition[] = [
	{
		id: "filter-vhs",
		type: "filter-vhs",
		name: "VHS",
		category: "camera",
		description: "Retro VHS tape distortion look",
		icon: "📼",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "saturate", value: 130, unit: "%" },
			{ filter: "contrast", value: 90, unit: "%" },
			{ filter: "brightness", value: 110, unit: "%" },
			{ filter: "hue-rotate", value: 5, unit: "deg" },
			{ filter: "blur", value: 0.5, unit: "px" },
		],
	},
	{
		id: "filter-retro-camcorder",
		type: "filter-retro-camcorder",
		name: "Retro Camcorder",
		category: "camera",
		description: "90s home video camcorder feel",
		icon: "📹",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "saturate", value: 120, unit: "%" },
			{ filter: "contrast", value: 85, unit: "%" },
			{ filter: "brightness", value: 115, unit: "%" },
			{ filter: "sepia", value: 15, unit: "%" },
		],
	},
	{
		id: "filter-polaroid",
		type: "filter-polaroid",
		name: "Polaroid",
		category: "camera",
		description: "Classic Polaroid instant photo look",
		icon: "📸",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "sepia", value: 25, unit: "%" },
			{ filter: "contrast", value: 105, unit: "%" },
			{ filter: "brightness", value: 108, unit: "%" },
			{ filter: "saturate", value: 90, unit: "%" },
		],
	},
	{
		id: "filter-film-burn",
		type: "filter-film-burn",
		name: "Film Burn",
		category: "camera",
		description: "Overexposed film burn effect",
		icon: "🔥",
		defaultIntensity: 0.5,
		filterRecipe: [
			{ filter: "brightness", value: 125, unit: "%" },
			{ filter: "contrast", value: 90, unit: "%" },
			{ filter: "sepia", value: 35, unit: "%" },
			{ filter: "saturate", value: 140, unit: "%" },
		],
	},
	{
		id: "filter-analog-noise",
		type: "filter-analog-noise",
		name: "Analog Noise",
		category: "camera",
		description: "Grainy analog film noise",
		icon: "📻",
		defaultIntensity: 0.5,
		filterRecipe: [
			{ filter: "contrast", value: 115, unit: "%" },
			{ filter: "saturate", value: 85, unit: "%" },
			{ filter: "brightness", value: 95, unit: "%" },
		],
	},
	{
		id: "filter-tape-distortion",
		type: "filter-tape-distortion",
		name: "Tape Distortion",
		category: "camera",
		description: "Worn VHS tape tracking distortion",
		icon: "🎵",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "contrast", value: 80, unit: "%" },
			{ filter: "saturate", value: 140, unit: "%" },
			{ filter: "brightness", value: 105, unit: "%" },
			{ filter: "hue-rotate", value: 10, unit: "deg" },
		],
	},
	{
		id: "filter-super8",
		type: "filter-super8",
		name: "Super 8",
		category: "camera",
		description: "Vintage Super 8mm film look",
		icon: "🎥",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "sepia", value: 35, unit: "%" },
			{ filter: "contrast", value: 120, unit: "%" },
			{ filter: "brightness", value: 90, unit: "%" },
			{ filter: "saturate", value: 110, unit: "%" },
		],
	},
	{
		id: "filter-lomography",
		type: "filter-lomography",
		name: "Lomography",
		category: "camera",
		description: "Lomo camera high-contrast vivid look",
		icon: "📷",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "contrast", value: 140, unit: "%" },
			{ filter: "saturate", value: 150, unit: "%" },
			{ filter: "brightness", value: 95, unit: "%" },
		],
	},
];

// ── Artistic Filters ──

const artisticFilters: FilterDefinition[] = [
	{
		id: "filter-anime",
		type: "filter-anime",
		name: "Anime",
		category: "artistic",
		description: "Anime-style vibrant colors and contrast",
		icon: "🎌",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "saturate", value: 180, unit: "%" },
			{ filter: "contrast", value: 120, unit: "%" },
			{ filter: "brightness", value: 108, unit: "%" },
		],
	},
	{
		id: "filter-oil-painting",
		type: "filter-oil-painting",
		name: "Oil Painting",
		category: "artistic",
		description: "Oil painting color palette with soft blur",
		icon: "🖼️",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "saturate", value: 150, unit: "%" },
			{ filter: "contrast", value: 130, unit: "%" },
			{ filter: "blur", value: 1, unit: "px" },
		],
	},
	{
		id: "filter-cartoon",
		type: "filter-cartoon",
		name: "Cartoon",
		category: "artistic",
		description: "High-contrast cartoon cel-shading look",
		icon: "🎨",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "contrast", value: 160, unit: "%" },
			{ filter: "saturate", value: 170, unit: "%" },
			{ filter: "brightness", value: 105, unit: "%" },
		],
	},
	{
		id: "filter-cyberpunk",
		type: "filter-cyberpunk",
		name: "Cyberpunk",
		category: "artistic",
		description: "Neon cyberpunk color aesthetic",
		icon: "🌆",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "hue-rotate", value: -30, unit: "deg" },
			{ filter: "saturate", value: 200, unit: "%" },
			{ filter: "contrast", value: 130, unit: "%" },
			{ filter: "brightness", value: 90, unit: "%" },
		],
	},
	{
		id: "filter-watercolor",
		type: "filter-watercolor",
		name: "Watercolor",
		category: "artistic",
		description: "Soft watercolor painting effect",
		icon: "💧",
		defaultIntensity: 0.6,
		filterRecipe: [
			{ filter: "saturate", value: 130, unit: "%" },
			{ filter: "contrast", value: 85, unit: "%" },
			{ filter: "brightness", value: 110, unit: "%" },
			{ filter: "blur", value: 0.8, unit: "px" },
		],
	},
	{
		id: "filter-dreamy",
		type: "filter-dreamy",
		name: "Dreamy",
		category: "artistic",
		description: "Soft dreamy glow with halation",
		icon: "💫",
		defaultIntensity: 0.5,
		filterRecipe: [
			{ filter: "brightness", value: 115, unit: "%" },
			{ filter: "contrast", value: 85, unit: "%" },
			{ filter: "saturate", value: 120, unit: "%" },
			{ filter: "blur", value: 1.5, unit: "px" },
		],
	},
	{
		id: "filter-pop-art",
		type: "filter-pop-art",
		name: "Pop Art",
		category: "artistic",
		description: "Bold, oversaturated pop art colors",
		icon: "🎪",
		defaultIntensity: 0.7,
		filterRecipe: [
			{ filter: "saturate", value: 250, unit: "%" },
			{ filter: "contrast", value: 140, unit: "%" },
			{ filter: "brightness", value: 105, unit: "%" },
		],
	},
	{
		id: "filter-sepia-classic",
		type: "filter-sepia-classic",
		name: "Sepia Classic",
		category: "artistic",
		description: "Warm sepia antique photo look",
		icon: "📜",
		defaultIntensity: 0.8,
		filterRecipe: [
			{ filter: "sepia", value: 80, unit: "%" },
			{ filter: "contrast", value: 105, unit: "%" },
		],
	},
];

// ── All Filters Registry ──

export const ALL_FILTERS: FilterDefinition[] = [
	...cinematicFilters,
	...colorFilters,
	...cameraFilters,
	...artisticFilters,
];

export const FILTER_MAP = new Map(ALL_FILTERS.map((f) => [f.id, f]));

export function getFilterById(id: string): FilterDefinition | undefined {
	return FILTER_MAP.get(id);
}

export function getFiltersByCategory(category: FilterCategory): FilterDefinition[] {
	return ALL_FILTERS.filter((f) => f.category === category);
}

/**
 * Build a CSS filter string from a FilterDefinition at a given intensity.
 * Intensity 0 = no filter (pass-through), intensity 1 = full recipe values.
 */
export function buildFilterCSSFromRecipe(
	recipe: FilterRecipeStep[],
	intensity: number,
): string {
	const parts: string[] = [];

	for (const step of recipe) {
		let value: number;

		switch (step.filter) {
			case "brightness":
			case "contrast":
			case "saturate": {
				// These default to 100% (normal). Lerp between 100% and recipe value.
				value = 100 + (step.value - 100) * intensity;
				break;
			}
			case "sepia":
			case "grayscale": {
				// These default to 0%. Lerp from 0 to recipe value.
				value = step.value * intensity;
				break;
			}
			case "hue-rotate": {
				// Default 0deg. Lerp from 0 to recipe value.
				value = step.value * intensity;
				break;
			}
			case "blur": {
				// Default 0px. Lerp from 0 to recipe value.
				value = step.value * intensity;
				break;
			}
			case "invert": {
				value = step.value * intensity;
				break;
			}
			case "opacity": {
				value = 100 + (step.value - 100) * intensity;
				break;
			}
			default: {
				value = step.value * intensity;
			}
		}

		parts.push(`${step.filter}(${value}${step.unit})`);
	}

	return parts.join(" ");
}
