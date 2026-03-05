import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { BlendMode } from "@/types/rendering";
import type { Transform } from "@/types/timeline";

const VISUAL_EPSILON = 1 / 1000;

export interface VisualNodeParams {
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	transform: Transform;
	opacity: number;
	blendMode?: BlendMode;
	effects?: { id: string; type: string; intensity: number }[];
	transitions?: {
		id: string;
		type: string;
		duration: number;
		direction: "in" | "out";
	}[];
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
		const containScale = Math.min(
			renderer.width / sourceWidth,
			renderer.height / sourceHeight,
		);
		const scaledWidth = sourceWidth * containScale * transform.scale;
		const scaledHeight = sourceHeight * containScale * transform.scale;
		const x = renderer.width / 2 + transform.position.x - scaledWidth / 2;
		const y = renderer.height / 2 + transform.position.y - scaledHeight / 2;

		renderer.context.globalCompositeOperation = (
			this.params.blendMode && this.params.blendMode !== "normal"
				? this.params.blendMode
				: "source-over"
		) as GlobalCompositeOperation;
		
		let currentOpacity = opacity;

		// Handle Transitions
		if (this.params.transitions && time !== undefined) {
			const localTime = this.getLocalTime(time);
			for (const transition of this.params.transitions) {
				if (transition.type === "fade") {
					if (transition.direction === "in") {
						const fadeEndTime = this.params.trimStart + transition.duration;
						if (localTime < fadeEndTime) {
							const progress = Math.max(0, (localTime - this.params.trimStart) / transition.duration);
							currentOpacity *= progress;
						}
					} else if (transition.direction === "out") {
						const fadeStartTime = this.params.trimStart + this.params.duration - transition.duration;
						if (localTime > fadeStartTime) {
							const progress = Math.max(0, (this.params.trimStart + this.params.duration - localTime) / transition.duration);
							currentOpacity *= progress;
						}
					}
				}
			}
		}

		renderer.context.globalAlpha = currentOpacity;

		// Handle Effects (Filters)
		if (this.params.effects && this.params.effects.length > 0) {
			const filters: string[] = [];
			for (const effect of this.params.effects) {
				if (effect.type === "blur") {
					filters.push(`blur(${effect.intensity * 20}px)`);
				} else if (effect.type === "grayscale") {
					filters.push(`grayscale(${effect.intensity * 100}%)`);
				} else if (effect.type === "sepia") {
					filters.push(`sepia(${effect.intensity * 100}%)`);
				} else if (effect.type === "brightness") {
					// 0.5 intensity = 100% brightness (normal).
					filters.push(`brightness(${effect.intensity * 200}%)`);
				} else if (effect.type === "contrast") {
					filters.push(`contrast(${effect.intensity * 200}%)`);
				}
			}
			if (filters.length > 0) {
				renderer.context.filter = filters.join(" ");
			}
		}

		if (transform.rotate !== 0) {
			const centerX = x + scaledWidth / 2;
			const centerY = y + scaledHeight / 2;
			renderer.context.translate(centerX, centerY);
			renderer.context.rotate((transform.rotate * Math.PI) / 180);
			renderer.context.translate(-centerX, -centerY);
		}

		renderer.context.drawImage(source, x, y, scaledWidth, scaledHeight);
		renderer.context.restore();
	}
}
