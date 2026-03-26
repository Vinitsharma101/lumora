import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { TextElement } from "@/types/timeline";
import {
	DEFAULT_TEXT_ELEMENT,
	DEFAULT_LINE_HEIGHT,
	FONT_SIZE_SCALE_REFERENCE,
} from "@/constants/text-constants";
import {
	getMetricAscent,
	getMetricDescent,
	getTextBackgroundRect,
	measureTextBlock,
} from "@/lib/text/layout";
import { getAnimationForWord } from "@/lib/text/animations";

function scaleFontSize({
	fontSize,
	canvasHeight,
}: {
	fontSize: number;
	canvasHeight: number;
}): number {
	return fontSize * (canvasHeight / FONT_SIZE_SCALE_REFERENCE);
}

function quoteFontFamily({ fontFamily }: { fontFamily: string }): string {
	return `"${fontFamily.replace(/"/g, '\\"')}"`;
}

function drawTextDecoration({
	ctx,
	textDecoration,
	lineWidth,
	lineY,
	metrics,
	scaledFontSize,
	textAlign,
}: {
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	textDecoration: string;
	lineWidth: number;
	lineY: number;
	metrics: TextMetrics;
	scaledFontSize: number;
	textAlign: CanvasTextAlign;
}): void {
	if (textDecoration === "none" || !textDecoration) return;

	const thickness = Math.max(1, scaledFontSize * 0.07);
	const ascent = getMetricAscent({ metrics, fallbackFontSize: scaledFontSize });
	const descent = getMetricDescent({ metrics, fallbackFontSize: scaledFontSize });

	let xStart = -lineWidth / 2;
	if (textAlign === "left") xStart = 0;
	if (textAlign === "right") xStart = -lineWidth;

	if (textDecoration === "underline") {
		const underlineY = lineY + descent + thickness;
		ctx.fillRect(xStart, underlineY, lineWidth, thickness);
	}

	if (textDecoration === "line-through") {
		const strikeY = lineY - (ascent - descent) * 0.35;
		ctx.fillRect(xStart, strikeY, lineWidth, thickness);
	}
}

export type TextNodeParams = TextElement & {
	canvasCenter: { x: number; y: number };
	canvasHeight: number;
	textBaseline?: CanvasTextBaseline;
};

export class TextNode extends BaseNode<TextNodeParams> {
	isInRange({ time }: { time: number }) {
		return (
			time >= this.params.startTime &&
			time < this.params.startTime + this.params.duration
		);
	}

	private renderKaraoke({
		renderer,
		time,
		scaledFontSize,
		lineHeightPx: _lineHeightPx,
		block,
	}: {
		renderer: CanvasRenderer;
		time: number;
		scaledFontSize: number;
		lineHeightPx: number;
		block: { visualCenterOffset: number };
	}) {
		const caption = this.params.caption;
		if (!caption?.wordTimings) return;

		const relativeTime = time - this.params.startTime;
		const animationType = caption.animationType ?? "karaoke";
		const highlightEffect = caption.highlightEffect ?? "color";
		const highlightColor = caption.highlightColor ?? "#FFFF00";
		const baseColor = this.params.color;

		let xOffset = 0;
		const spaceWidth = renderer.context.measureText(" ").width;

		const totalWidth = caption.wordTimings.reduce((sum, wt, index) => {
			const wordWidth = renderer.context.measureText(wt.word).width;
			return sum + wordWidth + (index < (caption.wordTimings?.length ?? 0) - 1 ? spaceWidth : 0);
		}, 0);

		if (this.params.textAlign === "center") {
			xOffset = -totalWidth / 2;
		} else if (this.params.textAlign === "right") {
			xOffset = -totalWidth;
		}

		const lineY = -block.visualCenterOffset;

		for (let i = 0; i < caption.wordTimings.length; i++) {
			const wt = caption.wordTimings[i];
			const wordWidth = renderer.context.measureText(wt.word).width;
			const isActive = relativeTime >= wt.start && relativeTime < wt.end;
			const isPast = relativeTime >= wt.end;

			const animation = getAnimationForWord({
				animationType,
				relativeTime,
				wordIndex: i,
				wordStart: wt.start,
				wordEnd: wt.end,
			});

			if (animation.opacity <= 0) {
				xOffset += wordWidth + spaceWidth;
				continue;
			}

			renderer.context.save();
			renderer.context.globalAlpha = this.params.opacity * animation.opacity;

			if (animation.scale !== 1) {
				const wordCenterX = xOffset + wordWidth / 2;
				renderer.context.translate(wordCenterX, lineY + animation.offsetY);
				renderer.context.scale(animation.scale, animation.scale);
				renderer.context.translate(-wordCenterX, -(lineY + animation.offsetY));
			}

			const drawY = lineY + animation.offsetY;

			if (isActive && highlightEffect === "background" && caption.highlightBackground) {
				renderer.context.fillStyle = caption.highlightBackground;
				const padding = 4;
				renderer.context.beginPath();
				renderer.context.roundRect(
					xOffset - padding,
					drawY - scaledFontSize * 0.8,
					wordWidth + padding * 2,
					scaledFontSize * 1.2,
					4,
				);
				renderer.context.fill();
			}

			if (isActive || (highlightEffect === "color" && isPast)) {
				renderer.context.fillStyle = isActive ? highlightColor : baseColor;
			} else {
				renderer.context.fillStyle = baseColor;
			}
			if (isActive && highlightEffect === "color") {
				renderer.context.fillStyle = highlightColor;
			}

			if (isActive && highlightEffect === "glow") {
				renderer.context.shadowColor = highlightColor;
				renderer.context.shadowBlur = 15;
			}

			if (this.params.stroke) {
				renderer.context.strokeStyle = this.params.stroke.color;
				renderer.context.lineWidth = this.params.stroke.width;
				renderer.context.lineJoin = "round";
				renderer.context.strokeText(wt.word, xOffset, drawY);
			}

			renderer.context.fillText(wt.word, xOffset, drawY);

			if (isActive && highlightEffect === "underline") {
				const underlineY = drawY + scaledFontSize * 0.15;
				renderer.context.fillStyle = highlightColor;
				renderer.context.fillRect(xOffset, underlineY, wordWidth, scaledFontSize * 0.07);
			}

			renderer.context.restore();
			xOffset += wordWidth + spaceWidth;
		}
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		if (!this.isInRange({ time })) {
			return;
		}

		renderer.context.save();

		const x = this.params.transform.position.x + this.params.canvasCenter.x;
		const y = this.params.transform.position.y + this.params.canvasCenter.y;

		renderer.context.translate(x, y);
		renderer.context.scale(
			this.params.transform.scale,
			this.params.transform.scale,
		);
		if (this.params.transform.rotate) {
			renderer.context.rotate((this.params.transform.rotate * Math.PI) / 180);
		}

		const fontWeight = this.params.fontWeight === "bold" ? "bold" : "normal";
		const fontStyle = this.params.fontStyle === "italic" ? "italic" : "normal";
		const scaledFontSize = scaleFontSize({
			fontSize: this.params.fontSize,
			canvasHeight: this.params.canvasHeight,
		});
		const fontFamily = quoteFontFamily({ fontFamily: this.params.fontFamily });
		renderer.context.font = `${fontStyle} ${fontWeight} ${scaledFontSize}px ${fontFamily}, sans-serif`;
		renderer.context.textAlign = this.params.textAlign;
		renderer.context.fillStyle = this.params.color;

		const letterSpacing = this.params.letterSpacing ?? 0;
		const lineHeight = this.params.lineHeight ?? DEFAULT_LINE_HEIGHT;
		if ("letterSpacing" in renderer.context) {
			(
				renderer.context as CanvasRenderingContext2D & { letterSpacing: string }
			).letterSpacing = `${letterSpacing}px`;
		}

		const lines = this.params.content.split("\n");
		const lineHeightPx = scaledFontSize * lineHeight;
		const fontSizeRatio = this.params.fontSize / DEFAULT_TEXT_ELEMENT.fontSize;
		const baseline = this.params.textBaseline ?? "middle";

		renderer.context.textBaseline = baseline;
		const lineMetrics = lines.map((line) => renderer.context.measureText(line));
		const lineCount = lines.length;

		const block = measureTextBlock({
			lineMetrics,
			lineHeightPx,
			fallbackFontSize: scaledFontSize,
		});

		const prevAlpha = renderer.context.globalAlpha;
		renderer.context.globalCompositeOperation = (
			this.params.blendMode && this.params.blendMode !== "normal"
				? this.params.blendMode
				: "source-over"
		) as GlobalCompositeOperation;
		renderer.context.globalAlpha = this.params.opacity;

		if (
			this.params.background.color &&
			this.params.background.color !== "transparent" &&
			lineCount > 0
		) {
			const { color, cornerRadius = 0 } = this.params.background;
			const backgroundRect = getTextBackgroundRect({
				textAlign: this.params.textAlign,
				block,
				background: this.params.background,
				fontSizeRatio,
			});
			if (backgroundRect) {
				renderer.context.fillStyle = color;
				renderer.context.beginPath();
				renderer.context.roundRect(
					backgroundRect.left,
					backgroundRect.top,
					backgroundRect.width,
					backgroundRect.height,
					cornerRadius,
				);
				renderer.context.fill();
				renderer.context.fillStyle = this.params.color;
			}
		}

		if (this.params.shadow) {
			renderer.context.shadowColor = this.params.shadow.color;
			renderer.context.shadowBlur = this.params.shadow.blur;
			renderer.context.shadowOffsetX = this.params.shadow.offsetX;
			renderer.context.shadowOffsetY = this.params.shadow.offsetY;
		}

		const hasKaraoke =
			this.params.caption?.wordTimings &&
			this.params.caption.wordTimings.length > 0 &&
			this.params.caption.animationType &&
			this.params.caption.animationType !== "none";

		if (hasKaraoke) {
			this.renderKaraoke({ renderer, time, scaledFontSize, lineHeightPx, block });
		} else {
			for (let i = 0; i < lineCount; i++) {
				const lineY = i * lineHeightPx - block.visualCenterOffset;

				if (this.params.stroke) {
					renderer.context.strokeStyle = this.params.stroke.color;
					renderer.context.lineWidth = this.params.stroke.width;
					renderer.context.lineJoin = "round";
					renderer.context.strokeText(lines[i], 0, lineY);
				}

				renderer.context.fillText(lines[i], 0, lineY);
				drawTextDecoration({
					ctx: renderer.context,
					textDecoration: this.params.textDecoration ?? "none",
					lineWidth: lineMetrics[i].width,
					lineY,
					metrics: lineMetrics[i],
					scaledFontSize,
					textAlign: this.params.textAlign,
				});
			}
		}

		renderer.context.shadowColor = "transparent";
		renderer.context.shadowBlur = 0;
		renderer.context.shadowOffsetX = 0;
		renderer.context.shadowOffsetY = 0;

		renderer.context.globalAlpha = prevAlpha;
		renderer.context.restore();
	}
}
