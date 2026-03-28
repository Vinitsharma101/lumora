/**
 * Effects Rendering Engine
 *
 * Applies visual effects to the Canvas 2D rendering context.
 * Called by visual-node.ts during the render pipeline.
 *
 * Each effect modifies the drawing context (filters, transforms, overlays)
 * using the Canvas 2D API. Effects that need pixel manipulation use
 * an offscreen canvas + getImageData/putImageData.
 */

import type { Effect } from "@/types/timeline";
import type { CanvasRenderer } from "@/services/renderer/canvas-renderer";
import { seededRandom } from "./easing";
import { FILTER_MAP, buildFilterCSSFromRecipe } from "./filter-definitions";
import { buildAdjustmentFilterCSS } from "./adjustment-definitions";

type EffectContext = {
	renderer: CanvasRenderer;
	effect: Effect;
	time: number;
	localTime: number;
	duration: number;
	x: number;
	y: number;
	width: number;
	height: number;
};

/**
 * Build a CSS filter string from an array of effects.
 * Used for effects that map directly to Canvas 2D filter property.
 */
const filterStringCache = new WeakMap<Effect[], { key: string; result: string }>();

function getEffectsCacheKey(effects: Effect[]): string {
	let key = "";
	for (let i = 0; i < effects.length; i++) {
		const e = effects[i];
		key += `${e.type}:${e.intensity ?? 1}|`;
	}
	return key;
}

export function buildFilterString(effects: Effect[]): string {
	const cacheKey = getEffectsCacheKey(effects);
	const cached = filterStringCache.get(effects);
	if (cached && cached.key === cacheKey) return cached.result;

	const filters: string[] = [];

	for (const effect of effects) {
		const intensity = effect.intensity ?? 1.0;

		switch (effect.type) {
			case "blur": {
				filters.push(`blur(${intensity * 20}px)`);
				break;
			}
			case "grayscale": {
				filters.push(`grayscale(${intensity * 100}%)`);
				break;
			}
			case "sepia": {
				filters.push(`sepia(${intensity * 100}%)`);
				break;
			}
			case "brightness": {
				filters.push(`brightness(${(intensity ?? 0.5) * 200}%)`);
				break;
			}
			case "contrast": {
				filters.push(`contrast(${(intensity ?? 0.5) * 200}%)`);
				break;
			}
			case "hdr-enhancement": {
				filters.push(`contrast(${100 + intensity * 40}%)`);
				filters.push(`saturate(${100 + intensity * 30}%)`);
				filters.push(`brightness(${100 + intensity * 10}%)`);
				break;
			}
			case "sharpen": {
				// Canvas 2D doesn't support sharpen as a filter natively.
				// We apply contrast + brightness for a pseudo-sharpen.
				filters.push(`contrast(${100 + intensity * 20}%)`);
				break;
			}
			case "color-grading": {
				const temperature = (effect.parameters?.temperature as number) ?? 0;
				const tint = (effect.parameters?.tint as number) ?? 0;
				// Approximate color grading via hue-rotate + saturate
				filters.push(`saturate(${100 + intensity * 30}%)`);
				filters.push(`hue-rotate(${temperature * 15}deg)`);
				if (tint !== 0) {
					filters.push(`hue-rotate(${tint * 10}deg)`);
				}
				break;
			}
			case "cinematic-lut": {
				const style = (effect.parameters?.style as string) ?? "blockbuster";
				switch (style) {
					case "blockbuster": {
						filters.push(`contrast(${100 + intensity * 25}%)`);
						filters.push(`saturate(${100 + intensity * 20}%)`);
						break;
					}
					case "indie": {
						filters.push(`saturate(${100 - intensity * 20}%)`);
						filters.push(`brightness(${100 + intensity * 5}%)`);
						break;
					}
					case "noir": {
						filters.push(`grayscale(${intensity * 80}%)`);
						filters.push(`contrast(${100 + intensity * 30}%)`);
						break;
					}
					case "scifi": {
						filters.push(`hue-rotate(${intensity * -20}deg)`);
						filters.push(`saturate(${100 + intensity * 40}%)`);
						filters.push(`contrast(${100 + intensity * 15}%)`);
						break;
					}
				}
				break;
			}
			case "golden-hour": {
				filters.push(`sepia(${intensity * 30}%)`);
				filters.push(`saturate(${100 + intensity * 40}%)`);
				filters.push(`brightness(${100 + intensity * 10}%)`);
				break;
			}
			case "night-cinematic": {
				filters.push(`brightness(${100 - intensity * 20}%)`);
				filters.push(`hue-rotate(${intensity * -15}deg)`);
				filters.push(`saturate(${100 + intensity * 10}%)`);
				filters.push(`contrast(${100 + intensity * 15}%)`);
				break;
			}
			case "vintage-film": {
				filters.push(`sepia(${intensity * 40}%)`);
				filters.push(`contrast(${100 + intensity * 10}%)`);
				filters.push(`brightness(${100 - intensity * 5}%)`);
				filters.push(`saturate(${100 - intensity * 15}%)`);
				break;
			}
			case "teal-orange": {
				filters.push(`saturate(${100 + intensity * 35}%)`);
				filters.push(`contrast(${100 + intensity * 15}%)`);
				filters.push(`hue-rotate(${intensity * -8}deg)`);
				break;
			}
			case "fade-film": {
				filters.push(`contrast(${100 - intensity * 20}%)`);
				filters.push(`brightness(${100 + intensity * 15}%)`);
				filters.push(`saturate(${100 - intensity * 25}%)`);
				break;
			}
			case "warm-tone": {
				filters.push(`sepia(${intensity * 20}%)`);
				filters.push(`saturate(${100 + intensity * 15}%)`);
				filters.push(`brightness(${100 + intensity * 5}%)`);
				break;
			}
			case "cool-tone": {
				filters.push(`hue-rotate(${intensity * -20}deg)`);
				filters.push(`saturate(${100 + intensity * 10}%)`);
				filters.push(`brightness(${100 - intensity * 5}%)`);
				break;
			}
			case "dream-glow": {
				filters.push(`blur(${intensity * 3}px)`);
				filters.push(`brightness(${100 + intensity * 20}%)`);
				filters.push(`saturate(${100 + intensity * 10}%)`);
				break;
			}
			case "motion-blur": {
				filters.push(`blur(${intensity * 8}px)`);
				break;
			}
			default: {
				// Handle filter-* types from the Filter Definitions registry
				if (effect.type.startsWith("filter-")) {
					const filterDef = FILTER_MAP.get(effect.type);
					if (filterDef) {
						filters.push(buildFilterCSSFromRecipe(filterDef.filterRecipe, intensity));
					}
				}
				// Handle adjust-* types from the Adjustment panel
				if (effect.type.startsWith("adjust-")) {
					const adjustCSS = buildAdjustmentFilterCSS([effect]);
					if (adjustCSS) {
						filters.push(adjustCSS);
					}
				}
				// Other effects handled by post-processing (not CSS filters):
				// film-grain, glitch, lens-flare, light-leaks, impact-flash,
				// ripple, warp-distortion, sparkle, fog-overlay, rgb-split,
				// vignette, pixelate, zoom-in, zoom-out, ken-burns, camera-shake,
				// speed-ramp, parallax, dolly-zoom, ai-* effects
				break;
			}
		}
	}

	const result = filters.join(" ");
	filterStringCache.set(effects, { key: cacheKey, result });
	return result;
}

/**
 * Compute opacity modifier from effects that change alpha.
 */
export function computeEffectOpacity(effects: Effect[], time: number, duration: number): number {
	let opacity = 1;
	const localProgress = duration > 0 ? time / duration : 0;

	for (const effect of effects) {
		if (effect.type === "impact-flash") {
			const intensity = effect.intensity ?? 0.8;
			// Flash peaks at 50% of clip, quick pulse
			const flashCenter = 0.5;
			const flashWidth = 0.05;
			const distance = Math.abs(localProgress - flashCenter);
			if (distance < flashWidth) {
				const flashProgress = 1 - distance / flashWidth;
				opacity *= 1 + flashProgress * intensity;
			}
		}
	}

	return Math.min(opacity, 1);
}

/**
 * Compute transform modifications from motion effects.
 * Returns modifiers to apply to the visual transform.
 */
export function computeEffectTransform(
	effects: Effect[],
	time: number,
	duration: number,
): {
	scaleMultiplier: number;
	translateX: number;
	translateY: number;
	rotateOffset: number;
} {
	let scaleMultiplier = 1;
	let translateX = 0;
	let translateY = 0;
	let rotateOffset = 0;

	const localProgress = duration > 0 ? time / duration : 0;

	for (const effect of effects) {
		const intensity = effect.intensity ?? 0.5;

		switch (effect.type) {
			case "zoom-in": {
				// Scale from 1.0 to 1.0 + intensity * 0.3
				scaleMultiplier *= 1 + localProgress * intensity * 0.3;
				break;
			}
			case "zoom-out": {
				// Scale from 1.0 + intensity * 0.3 down to 1.0
				scaleMultiplier *= 1 + (1 - localProgress) * intensity * 0.3;
				break;
			}
			case "ken-burns": {
				const direction = (effect.parameters?.direction as string) ?? "top-left-to-bottom-right";
				const panAmount = intensity * 30;
				const zoomAmount = intensity * 0.15;

				switch (direction) {
					case "top-left-to-bottom-right": {
						translateX += (localProgress - 0.5) * panAmount;
						translateY += (localProgress - 0.5) * panAmount;
						scaleMultiplier *= 1 + localProgress * zoomAmount;
						break;
					}
					case "bottom-right-to-top-left": {
						translateX -= (localProgress - 0.5) * panAmount;
						translateY -= (localProgress - 0.5) * panAmount;
						scaleMultiplier *= 1 + (1 - localProgress) * zoomAmount;
						break;
					}
					case "center-out": {
						scaleMultiplier *= 1 + localProgress * zoomAmount * 2;
						break;
					}
					default: {
						// "random" – use seeded pseudo-random
						const seed = Math.floor(time * 10);
						translateX += (seededRandom(seed) - 0.5) * panAmount * localProgress;
						translateY += (seededRandom(seed + 1) - 0.5) * panAmount * localProgress;
						scaleMultiplier *= 1 + localProgress * zoomAmount;
					}
				}
				break;
			}
			case "camera-shake": {
				const shakeAmount = intensity * 8;
				const seed = Math.floor(time * 30); // 30 shakes per second
				translateX += (seededRandom(seed) - 0.5) * shakeAmount;
				translateY += (seededRandom(seed + 1) - 0.5) * shakeAmount;
				rotateOffset += (seededRandom(seed + 2) - 0.5) * intensity * 2;
				break;
			}
			case "parallax": {
				translateX += Math.sin(localProgress * Math.PI * 2) * intensity * 15;
				break;
			}
			case "dolly-zoom": {
				// Push in while zooming out (or vice versa)
				const dollyProgress = Math.sin(localProgress * Math.PI);
				scaleMultiplier *= 1 + dollyProgress * intensity * 0.2;
				translateY += dollyProgress * intensity * -10;
				break;
			}
		}
	}

	return { scaleMultiplier, translateX, translateY, rotateOffset };
}

/**
 * Apply post-processing overlay effects directly to canvas.
 * Called after the main image has been drawn.
 * These effects draw ON TOP of the rendered content.
 */
export function applyOverlayEffects(context: EffectContext): void {
	const { renderer, effect, time, x, y, width, height } = context;
	const intensity = effect.intensity ?? 0.5;
	const ctx = renderer.context;

	switch (effect.type) {
		case "film-grain": {
			applyFilmGrain(ctx, intensity, time, x, y, width, height);
			break;
		}
		case "vignette": {
			applyVignette(ctx, intensity, x, y, width, height);
			break;
		}
		case "light-leaks": {
			applyLightLeaks(ctx, intensity, time, x, y, width, height);
			break;
		}
		case "fog-overlay": {
			applyFogOverlay(ctx, intensity, time, x, y, width, height);
			break;
		}
		case "sparkle": {
			applySparkle(ctx, intensity, time, x, y, width, height);
			break;
		}
		case "lens-flare": {
			const posX = (effect.parameters?.positionX as number) ?? 0.7;
			const posY = (effect.parameters?.positionY as number) ?? 0.3;
			applyLensFlare(ctx, intensity, x, y, width, height, posX, posY);
			break;
		}
	}
}

// ── Overlay Helpers ──

function applyFilmGrain(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	intensity: number,
	time: number,
	x: number,
	y: number,
	width: number,
	height: number,
): void {
	ctx.save();
	ctx.globalAlpha = intensity * 0.15;
	ctx.globalCompositeOperation = "overlay";

	// Generate grain pattern using small rectangles
	const grainSize = 3;
	const seed = Math.floor(time * 24); // Change grain every frame at 24fps

	for (let gx = 0; gx < width; gx += grainSize * 4) {
		for (let gy = 0; gy < height; gy += grainSize * 4) {
			const noise = seededRandom(seed + gx * 100 + gy);
			const grainValue = Math.floor(noise * 255);
			ctx.fillStyle = `rgb(${grainValue}, ${grainValue}, ${grainValue})`;
			ctx.fillRect(x + gx, y + gy, grainSize, grainSize);
		}
	}

	ctx.restore();
}

function applyVignette(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	intensity: number,
	x: number,
	y: number,
	width: number,
	height: number,
): void {
	ctx.save();

	const centerX = x + width / 2;
	const centerY = y + height / 2;
	const radius = Math.max(width, height) * 0.7;

	const gradient = ctx.createRadialGradient(
		centerX, centerY, radius * (1 - intensity * 0.5),
		centerX, centerY, radius,
	);
	gradient.addColorStop(0, "rgba(0,0,0,0)");
	gradient.addColorStop(1, `rgba(0,0,0,${intensity * 0.8})`);

	ctx.fillStyle = gradient;
	ctx.fillRect(x, y, width, height);

	ctx.restore();
}

function applyLightLeaks(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	intensity: number,
	time: number,
	x: number,
	y: number,
	width: number,
	height: number,
): void {
	ctx.save();
	ctx.globalAlpha = intensity * 0.3;
	ctx.globalCompositeOperation = "screen";

	// Animate light leak position
	const leakX = x + width * (0.3 + Math.sin(time * 0.5) * 0.3);
	const leakY = y + height * (0.2 + Math.cos(time * 0.3) * 0.2);
	const leakRadius = Math.min(width, height) * 0.6;

	const gradient = ctx.createRadialGradient(
		leakX, leakY, 0,
		leakX, leakY, leakRadius,
	);
	gradient.addColorStop(0, "rgba(255, 200, 100, 0.8)");
	gradient.addColorStop(0.3, "rgba(255, 150, 50, 0.4)");
	gradient.addColorStop(0.7, "rgba(255, 100, 50, 0.1)");
	gradient.addColorStop(1, "rgba(255, 50, 0, 0)");

	ctx.fillStyle = gradient;
	ctx.fillRect(x, y, width, height);

	ctx.restore();
}

function applyFogOverlay(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	intensity: number,
	time: number,
	x: number,
	y: number,
	width: number,
	height: number,
): void {
	ctx.save();
	ctx.globalAlpha = intensity * 0.25;
	ctx.globalCompositeOperation = "screen";

	// Multiple fog layers for depth
	for (let layer = 0; layer < 3; layer++) {
		const offset = Math.sin(time * 0.2 + layer * 2) * width * 0.1;
		const gradient = ctx.createLinearGradient(
			x + offset, y + height * 0.5,
			x + width + offset, y + height,
		);
		gradient.addColorStop(0, "rgba(200, 210, 220, 0)");
		gradient.addColorStop(0.4, `rgba(200, 210, 220, ${0.3 * (layer + 1) / 3})`);
		gradient.addColorStop(0.7, `rgba(180, 195, 210, ${0.2 * (layer + 1) / 3})`);
		gradient.addColorStop(1, "rgba(200, 210, 220, 0)");

		ctx.fillStyle = gradient;
		ctx.fillRect(x, y, width, height);
	}

	ctx.restore();
}

function applySparkle(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	intensity: number,
	time: number,
	x: number,
	y: number,
	width: number,
	height: number,
): void {
	ctx.save();
	ctx.globalCompositeOperation = "screen";

	const particleCount = Math.floor(intensity * 20);
	const seed = Math.floor(time * 12);

	for (let index = 0; index < particleCount; index++) {
		const px = x + seededRandom(seed + index * 3) * width;
		const py = y + seededRandom(seed + index * 3 + 1) * height;
		const size = seededRandom(seed + index * 3 + 2) * 4 + 1;
		const alpha = seededRandom(seed + index * 5) * intensity;

		ctx.globalAlpha = alpha;
		ctx.fillStyle = "#ffffff";
		ctx.beginPath();
		ctx.arc(px, py, size, 0, Math.PI * 2);
		ctx.fill();

		// Cross sparkle
		ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(px - size * 2, py);
		ctx.lineTo(px + size * 2, py);
		ctx.moveTo(px, py - size * 2);
		ctx.lineTo(px, py + size * 2);
		ctx.stroke();
	}

	ctx.restore();
}

function applyLensFlare(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	intensity: number,
	x: number,
	y: number,
	width: number,
	height: number,
	posX: number,
	posY: number,
): void {
	ctx.save();
	ctx.globalAlpha = intensity * 0.6;
	ctx.globalCompositeOperation = "screen";

	const flareX = x + width * posX;
	const flareY = y + height * posY;

	// Main flare
	const mainRadius = Math.min(width, height) * 0.15;
	const mainGradient = ctx.createRadialGradient(
		flareX, flareY, 0,
		flareX, flareY, mainRadius,
	);
	mainGradient.addColorStop(0, "rgba(255, 255, 240, 1)");
	mainGradient.addColorStop(0.2, "rgba(255, 220, 150, 0.6)");
	mainGradient.addColorStop(0.5, "rgba(255, 180, 100, 0.2)");
	mainGradient.addColorStop(1, "rgba(255, 150, 50, 0)");

	ctx.fillStyle = mainGradient;
	ctx.fillRect(x, y, width, height);

	// Secondary flares along the line from center to source
	const centerX = x + width / 2;
	const centerY = y + height / 2;

	for (let index = 1; index <= 4; index++) {
		const fraction = index / 5;
		const secondaryX = flareX + (centerX - flareX) * fraction * 1.5;
		const secondaryY = flareY + (centerY - flareY) * fraction * 1.5;
		const secondaryRadius = mainRadius * (0.1 + fraction * 0.15);

		ctx.globalAlpha = intensity * 0.2 * (1 - fraction);

		const secondaryGradient = ctx.createRadialGradient(
			secondaryX, secondaryY, 0,
			secondaryX, secondaryY, secondaryRadius,
		);
		secondaryGradient.addColorStop(0, "rgba(100, 180, 255, 0.8)");
		secondaryGradient.addColorStop(1, "rgba(100, 180, 255, 0)");

		ctx.fillStyle = secondaryGradient;
		ctx.fillRect(x, y, width, height);
	}

	ctx.restore();
}

const OVERLAY_TYPES = new Set([
	"film-grain",
	"vignette",
	"light-leaks",
	"fog-overlay",
	"sparkle",
	"lens-flare",
]);

const FILTER_TYPES = new Set([
	"blur",
	"grayscale",
	"sepia",
	"brightness",
	"contrast",
	"hdr-enhancement",
	"sharpen",
	"color-grading",
	"cinematic-lut",
	"golden-hour",
	"night-cinematic",
	"vintage-film",
	"teal-orange",
	"fade-film",
	"warm-tone",
	"cool-tone",
	"dream-glow",
	"motion-blur",
]);

const TRANSFORM_TYPES = new Set([
	"zoom-in",
	"zoom-out",
	"ken-burns",
	"camera-shake",
	"parallax",
	"dolly-zoom",
]);

/**
 * Check whether an effect needs post-processing overlay rendering.
 */
export function isOverlayEffect(effectType: string): boolean {
	return OVERLAY_TYPES.has(effectType);
}

/**
 * Check whether an effect uses CSS filter strings.
 */
export function isFilterEffect(effectType: string): boolean {
	if (effectType.startsWith("filter-")) return true;
	if (effectType.startsWith("adjust-")) return true;
	return FILTER_TYPES.has(effectType);
}

/**
 * Check whether an effect needs transform modifications.
 */
export function isTransformEffect(effectType: string): boolean {
	return TRANSFORM_TYPES.has(effectType);
}
