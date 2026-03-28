import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";

export type BlurBackgroundNodeParams = {
	blurIntensity: number;
	contentNodes: BaseNode[];
};

export class BlurBackgroundNode extends BaseNode<BlurBackgroundNodeParams> {
	private blurIntensity: number;
	private contentNodes: BaseNode[];
	private offscreen: OffscreenCanvas | HTMLCanvasElement | null = null;
	private offscreenCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
	private cachedWidth = 0;
	private cachedHeight = 0;

	constructor(params: BlurBackgroundNodeParams) {
		super(params);
		this.blurIntensity = params.blurIntensity;
		this.contentNodes = params.contentNodes;
	}

	private ensureOffscreen(width: number, height: number): void {
		if (this.offscreen && this.cachedWidth === width && this.cachedHeight === height) {
			const ctx = this.offscreenCtx!;
			ctx.clearRect(0, 0, width, height);
			return;
		}

		try {
			this.offscreen = new OffscreenCanvas(width, height);
			const ctx = this.offscreen.getContext("2d");
			if (!ctx) throw new Error("failed to get offscreen canvas context");
			this.offscreenCtx = ctx;
		} catch {
			this.offscreen = document.createElement("canvas");
			this.offscreen.width = width;
			this.offscreen.height = height;
			const ctx = this.offscreen.getContext("2d");
			if (!ctx) throw new Error("failed to get canvas context");
			this.offscreenCtx = ctx;
		}

		this.cachedWidth = width;
		this.cachedHeight = height;
	}

	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		this.ensureOffscreen(renderer.width, renderer.height);

		const originalContext = renderer.context;
		renderer.context = this.offscreenCtx!;

		for (const node of this.contentNodes) {
			await node.render({ renderer, time });
		}

		renderer.context = originalContext;

		const zoomScale = 1.4;
		const scaledWidth = renderer.width * zoomScale;
		const scaledHeight = renderer.height * zoomScale;
		const offsetX = (renderer.width - scaledWidth) / 2;
		const offsetY = (renderer.height - scaledHeight) / 2;

		renderer.context.save();
		renderer.context.filter = `blur(${this.blurIntensity}px)`;
		renderer.context.drawImage(
			this.offscreen as CanvasImageSource,
			offsetX,
			offsetY,
			scaledWidth,
			scaledHeight,
		);
		renderer.context.restore();
	}
}
