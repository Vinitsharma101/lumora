/**
 * Easing Functions
 *
 * Mathematical easing functions for smooth animation curves.
 * Used by both effects and transitions.
 */

import type { EasingType } from "@/types/effects";

export function applyEasing(progress: number, type: EasingType = "easeInOut"): number {
	const clampedProgress = Math.max(0, Math.min(1, progress));

	switch (type) {
		case "linear": {
			return clampedProgress;
		}
		case "easeIn": {
			return clampedProgress * clampedProgress;
		}
		case "easeOut": {
			return 1 - (1 - clampedProgress) * (1 - clampedProgress);
		}
		case "easeInOut": {
			return clampedProgress < 0.5
				? 2 * clampedProgress * clampedProgress
				: 1 - (-2 * clampedProgress + 2) ** 2 / 2;
		}
		case "easeInCubic": {
			return clampedProgress ** 3;
		}
		case "easeOutCubic": {
			return 1 - (1 - clampedProgress) ** 3;
		}
		case "easeInOutCubic": {
			return clampedProgress < 0.5
				? 4 * clampedProgress ** 3
				: 1 - (-2 * clampedProgress + 2) ** 3 / 2;
		}
		case "easeInBack": {
			const c1 = 1.70158;
			const c3 = c1 + 1;
			return c3 * clampedProgress ** 3 - c1 * clampedProgress ** 2;
		}
		case "easeOutBack": {
			const c1 = 1.70158;
			const c3 = c1 + 1;
			return 1 + c3 * (clampedProgress - 1) ** 3 + c1 * (clampedProgress - 1) ** 2;
		}
		case "easeInOutBack": {
			const c1 = 1.70158;
			const c2 = c1 * 1.525;
			return clampedProgress < 0.5
				? ((2 * clampedProgress) ** 2 * ((c2 + 1) * 2 * clampedProgress - c2)) / 2
				: ((2 * clampedProgress - 2) ** 2 * ((c2 + 1) * (clampedProgress * 2 - 2) + c2) + 2) / 2;
		}
		case "bounce": {
			return easeOutBounce(clampedProgress);
		}
		default: {
			return clampedProgress;
		}
	}
}

function easeOutBounce(progress: number): number {
	const n1 = 7.5625;
	const d1 = 2.75;

	if (progress < 1 / d1) {
		return n1 * progress * progress;
	}
	if (progress < 2 / d1) {
		const adjusted = progress - 1.5 / d1;
		return n1 * adjusted * adjusted + 0.75;
	}
	if (progress < 2.5 / d1) {
		const adjusted = progress - 2.25 / d1;
		return n1 * adjusted * adjusted + 0.9375;
	}
	const adjusted = progress - 2.625 / d1;
	return n1 * adjusted * adjusted + 0.984375;
}

/**
 * Simple pseudo-random number generator for deterministic effects.
 * Uses a seed so the same frame always produces the same "random" result.
 */
export function seededRandom(seed: number): number {
	const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
}
