import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { BlendMode } from "@/types/rendering";
import type { Transform, Effect, Transition } from "@/types/timeline";
import {
	buildFilterString,
	computeEffectOpacity,
	computeEffectTransform,
	applyOverlayEffects,
	isOverlayEffect,
} from "@/lib/effects/effects-engine";
import {
	computeTransitions,
	renderFlashOverlay,
	renderGlitchOverlay,
} from "@/lib/effects/transitions-engine";

const VISUAL_EPSILON = 1 / 1000;

export interface VisualNodeParams {
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	transform: Transform;
	opacity: number;
	blendMode?: BlendMode;
	effects?: Effect[];
	transitions?: Transition[];
}

export abstract class VisualNode<
	Params extends VisualNodeParams = VisualNodeParams,
> extends BaseNode<Params> {
	protected getLocalTime(time: number): number {
		return time - this.params.timeOffset + this.params.trimStart;
	}

	protected isInRange(time: number): boolean {
		const localTime = this.getLocalTime(time);
		return (
			localTime >= this.params.trimStart - VISUAL_EPSILON &&
			localTime < this.params.trimStart + this.params.duration
		);
	}

	protected renderVisual({
		renderer,
		source,
		sourceWidth,
		sourceHeight,
		time,
	}: {
		renderer: CanvasRenderer;
		source: CanvasImageSource;
		sourceWidth: number;
		sourceHeight: number;
		time?: number;
	}): void {
		renderer.context.save();

		const { transform, opacity } = this.params;
		const localTime = time !== undefined ? this.getLocalTime(time) : this.params.trimStart;
		const effectTime = localTime - this.params.trimStart;

		// ── Base geometry ──
		const containScale = Math.min(
			renderer.width / sourceWidth,
			renderer.height / sourceHeight,
		);
		let scaledWidth = sourceWidth * containScale * transform.scale;
		let scaledHeight = sourceHeight * containScale * transform.scale;
		let offsetX = 0;
		let offsetY = 0;
		let rotateOffset = 0;

		// ── Blend mode ──
		renderer.context.globalCompositeOperation = (
			this.params.blendMode && this.params.blendMode !== "normal"
				? this.params.blendMode
				: "source-over"
		) as GlobalCompositeOperation;

		let currentOpacity = opacity;

		// ── Effects: transform modifications ──
		if (this.params.effects && this.params.effects.length > 0) {
			const effectTransform = computeEffectTransform(
				this.params.effects,
				effectTime,
				this.params.duration,
			);
			scaledWidth *= effectTransform.scaleMultiplier;
			scaledHeight *= effectTransform.scaleMultiplier;
			offsetX += effectTransform.translateX;
			offsetY += effectTransform.translateY;
			rotateOffset += effectTransform.rotateOffset;

			// Apply effect-driven opacity changes
			currentOpacity *= computeEffectOpacity(
				this.params.effects,
				effectTime,
				this.params.duration,
			);
		}

		// ── Transitions: opacity + transform modifications ──
		let transitionFlash = 0;
		let transitionGlitch = 0;

		if (this.params.transitions && this.params.transitions.length > 0 && time !== undefined) {
			const transResult = computeTransitions(
				this.params.transitions,
				localTime,
				this.params.trimStart,
				this.params.duration,
			);
			currentOpacity *= transResult.opacity;
			scaledWidth *= transResult.scaleMultiplier;
			scaledHeight *= transResult.scaleMultiplier;
			offsetX += transResult.translateX;
			offsetY += transResult.translateY;
			rotateOffset += transResult.rotateOffset;
			transitionFlash = transResult.flashOverlay;
			transitionGlitch = transResult.glitchOffset;

			// Transition blur adds to effect filters
			if (transResult.blurAmount > 0) {
				const existingFilter = renderer.context.filter === "none" ? "" : renderer.context.filter;
				renderer.context.filter = `${existingFilter} blur(${transResult.blurAmount}px)`.trim();
			}
		}

		renderer.context.globalAlpha = Math.max(0, Math.min(1, currentOpacity));

		// ── Effects: CSS filter string ──
		if (this.params.effects && this.params.effects.length > 0) {
			const filterString = buildFilterString(this.params.effects);
			if (filterString) {
				const existing = renderer.context.filter === "none" ? "" : renderer.context.filter;
				renderer.context.filter = `${existing} ${filterString}`.trim();
			}
		}

		// ── Compute final position ──
		const x = renderer.width / 2 + transform.position.x + offsetX - scaledWidth / 2;
		const y = renderer.height / 2 + transform.position.y + offsetY - scaledHeight / 2;

		// ── Rotation (base + effect + transition) ──
		const totalRotation = transform.rotate + rotateOffset;
		if (totalRotation !== 0) {
			const centerX = x + scaledWidth / 2;
			const centerY = y + scaledHeight / 2;
			renderer.context.translate(centerX, centerY);
			renderer.context.rotate((totalRotation * Math.PI) / 180);
			renderer.context.translate(-centerX, -centerY);
		}

		// ── Draw the source ──
		renderer.context.drawImage(source, x, y, scaledWidth, scaledHeight);

		// ── Post-processing: overlay effects ──
		if (this.params.effects && this.params.effects.length > 0) {
			// Reset filter for overlays (they draw raw)
			renderer.context.filter = "none";
			renderer.context.globalAlpha = 1;

			for (const effect of this.params.effects) {
				if (isOverlayEffect(effect.type)) {
					applyOverlayEffects({
						renderer,
						effect,
						time: effectTime,
						localTime,
						duration: this.params.duration,
						x,
						y,
						width: scaledWidth,
						height: scaledHeight,
					});
				}
			}
		}

		// ── Post-processing: transition overlays ──
		if (transitionFlash > 0) {
			renderFlashOverlay(renderer.context, transitionFlash, x, y, scaledWidth, scaledHeight);
		}
		if (transitionGlitch > 0) {
			renderGlitchOverlay(renderer.context, transitionGlitch, x, y, scaledWidth, scaledHeight);
		}

		renderer.context.restore();
	}
}
