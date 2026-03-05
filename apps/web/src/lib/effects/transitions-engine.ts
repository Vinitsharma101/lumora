/**
 * Transitions Rendering Engine
 *
 * Applies transition effects to clips during render.
 * Transitions modify opacity, position, scale, rotation, blur, and overlays
 * at the start (in) or end (out) of a clip's visible duration.
 */

import type { Transition } from "@/types/timeline";
import type { EasingType } from "@/types/effects";
import { applyEasing, seededRandom } from "./easing";

export interface TransitionResult {
	opacity: number;
	scaleMultiplier: number;
	translateX: number;
	translateY: number;
	rotateOffset: number;
	blurAmount: number;
	flashOverlay: number;
	glitchOffset: number;
}

const DEFAULT_RESULT: TransitionResult = {
	opacity: 1,
	scaleMultiplier: 1,
	translateX: 0,
	translateY: 0,
	rotateOffset: 0,
	blurAmount: 0,
	flashOverlay: 0,
	glitchOffset: 0,
};

/**
 * Compute transition modifications at a given time.
 *
 *   localTime – time relative to clip start (after trim)
 *   trimStart – clip trim start
 *   duration  – clip duration
 */
export function computeTransitions(
	transitions: Transition[],
	localTime: number,
	trimStart: number,
	duration: number,
): TransitionResult {
	const result = { ...DEFAULT_RESULT };

	for (const transition of transitions) {
		const easing: EasingType = (transition.easing as EasingType) ?? "easeInOut";
		let progress = 0;
		let active = false;

		if (transition.direction === "in") {
			const transEnd = trimStart + transition.duration;
			if (localTime < transEnd) {
				progress = Math.max(0, (localTime - trimStart) / transition.duration);
				active = true;
			}
		} else if (transition.direction === "out") {
			const transStart = trimStart + duration - transition.duration;
			if (localTime > transStart) {
				progress = Math.max(
					0,
					(trimStart + duration - localTime) / transition.duration,
				);
				active = true;
			}
		}

		if (!active) continue;

		const easedProgress = applyEasing(progress, easing);

		switch (transition.type) {
			// ── Basic ──
			case "fade": {
				result.opacity *= easedProgress;
				break;
			}
			case "cross-dissolve": {
				result.opacity *= easedProgress;
				break;
			}
			case "dip-to-black": {
				// Fade through black: opacity dips to 0 at midpoint
				const dipProgress = progress < 0.5
					? applyEasing(progress * 2, easing)
					: applyEasing((1 - progress) * 2, easing);
				result.opacity *= dipProgress;
				break;
			}
			case "dip-to-white": {
				const dipProgress = progress < 0.5
					? applyEasing(progress * 2, easing)
					: applyEasing((1 - progress) * 2, easing);
				result.opacity *= dipProgress;
				result.flashOverlay = Math.max(
					result.flashOverlay,
					(1 - dipProgress) * 0.8,
				);
				break;
			}
			case "wipe": {
				// Reveal via horizontal clip
				result.translateX += (1 - easedProgress) * -100;
				break;
			}
			case "slide": {
				result.translateX += (1 - easedProgress) * (transition.direction === "in" ? -200 : 200);
				break;
			}
			case "push": {
				result.translateX += (1 - easedProgress) * (transition.direction === "in" ? -300 : 300);
				break;
			}
			case "crossfade": {
				result.opacity *= easedProgress;
				break;
			}

			// ── Cinematic ──
			case "whip-pan": {
				const whipProgress = applyEasing(progress, "easeInOutCubic");
				result.translateX += (1 - whipProgress) * (transition.direction === "in" ? -400 : 400);
				result.blurAmount += (1 - whipProgress) * 15;
				break;
			}
			case "zoom-transition": {
				result.scaleMultiplier *= 1 + (1 - easedProgress) * 0.5;
				result.opacity *= easedProgress;
				break;
			}
			case "spin-transition": {
				result.rotateOffset += (1 - easedProgress) * 90;
				result.opacity *= easedProgress;
				break;
			}
			case "blur-transition": {
				result.blurAmount += (1 - easedProgress) * 20;
				result.opacity *= easedProgress;
				break;
			}
			case "camera-pan": {
				const panProgress = applyEasing(progress, "easeOutCubic");
				result.translateX += (1 - panProgress) * -200;
				result.blurAmount += (1 - panProgress) * 5;
				break;
			}
			case "flash-transition": {
				// Quick flash then reveal
				if (progress < 0.3) {
					result.flashOverlay = Math.max(result.flashOverlay, 1 - progress / 0.3);
				}
				result.opacity *= easedProgress;
				break;
			}
			case "warp-transition": {
				result.scaleMultiplier *= 1 + Math.sin((1 - easedProgress) * Math.PI) * 0.3;
				result.translateX += Math.sin((1 - easedProgress) * Math.PI * 3) * 20;
				result.opacity *= easedProgress;
				break;
			}
			case "light-leak-transition": {
				result.opacity *= easedProgress;
				result.flashOverlay = Math.max(
					result.flashOverlay,
					(1 - easedProgress) * 0.4,
				);
				break;
			}

			// ── Viral / Social ──
			case "glitch-transition": {
				const seed = Math.floor(localTime * 30);
				result.glitchOffset = (1 - easedProgress) * 20;
				result.translateX += (seededRandom(seed) - 0.5) * result.glitchOffset * 3;
				result.translateY += (seededRandom(seed + 1) - 0.5) * result.glitchOffset;
				result.opacity *= Math.max(0.3, easedProgress);
				break;
			}
			case "mask-transition": {
				// Circle mask reveal
				result.scaleMultiplier *= 0.5 + easedProgress * 0.5;
				result.opacity *= easedProgress;
				break;
			}
			case "liquid-morph": {
				result.scaleMultiplier *= 1 + Math.sin((1 - easedProgress) * Math.PI) * 0.15;
				result.translateY += Math.sin((1 - easedProgress) * Math.PI * 2) * 15;
				result.opacity *= easedProgress;
				break;
			}
			case "shape-morph": {
				result.scaleMultiplier *= easedProgress;
				result.rotateOffset += (1 - easedProgress) * 45;
				result.opacity *= easedProgress;
				break;
			}
			case "pixel-sort": {
				result.translateX += (1 - easedProgress) * 50;
				result.glitchOffset = (1 - easedProgress) * 10;
				result.opacity *= Math.max(0.5, easedProgress);
				break;
			}
			case "rgb-split-transition": {
				result.glitchOffset = (1 - easedProgress) * 15;
				result.opacity *= easedProgress;
				break;
			}
			case "frame-smash": {
				const smashScale = 1 + (1 - easedProgress) * 0.3;
				result.scaleMultiplier *= smashScale;
				result.rotateOffset += (seededRandom(Math.floor(localTime * 20)) - 0.5) * (1 - easedProgress) * 10;
				result.opacity *= Math.max(0.4, easedProgress);
				break;
			}
			case "swipe-match": {
				result.translateY += (1 - easedProgress) * (transition.direction === "in" ? -300 : 300);
				result.opacity *= easedProgress;
				break;
			}

			// ── Beat Sync ──
			case "beat-flash": {
				result.flashOverlay = Math.max(
					result.flashOverlay,
					(1 - easedProgress) * 0.9,
				);
				break;
			}
			case "beat-zoom": {
				result.scaleMultiplier *= 1 + (1 - easedProgress) * 0.15;
				break;
			}
			case "beat-glitch": {
				const seed = Math.floor(localTime * 60);
				result.glitchOffset = (1 - easedProgress) * 12;
				result.translateX += (seededRandom(seed) - 0.5) * result.glitchOffset * 2;
				break;
			}
			case "beat-shake": {
				const seed = Math.floor(localTime * 40);
				const shakeAmount = (1 - easedProgress) * 10;
				result.translateX += (seededRandom(seed) - 0.5) * shakeAmount;
				result.translateY += (seededRandom(seed + 1) - 0.5) * shakeAmount;
				break;
			}
			case "beat-cut": {
				// Hard cut – just snap opacity
				result.opacity *= progress > 0.1 ? 1 : 0;
				break;
			}
		}
	}

	return result;
}

/**
 * Apply flash overlay composite after main draw.
 */
export function renderFlashOverlay(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	flashIntensity: number,
	x: number,
	y: number,
	width: number,
	height: number,
): void {
	if (flashIntensity <= 0) return;

	ctx.save();
	ctx.globalAlpha = flashIntensity;
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(x, y, width, height);
	ctx.restore();
}

/**
 * Apply glitch RGB offset composite after main draw.
 */
export function renderGlitchOverlay(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	glitchOffset: number,
	x: number,
	y: number,
	width: number,
	height: number,
): void {
	if (glitchOffset <= 0) return;

	ctx.save();

	// Render horizontal scan line artifacts
	ctx.globalAlpha = 0.15;
	const scanLineCount = Math.floor(glitchOffset * 2);
	for (let index = 0; index < scanLineCount; index++) {
		const lineY = y + seededRandom(index * 37) * height;
		const lineHeight = 2 + seededRandom(index * 41) * 4;
		const lineOffset = (seededRandom(index * 53) - 0.5) * glitchOffset * 3;

		ctx.fillStyle = seededRandom(index * 61) > 0.5
			? "rgba(255, 0, 0, 0.3)"
			: "rgba(0, 255, 255, 0.3)";
		ctx.fillRect(x + lineOffset, lineY, width, lineHeight);
	}

	ctx.restore();
}
