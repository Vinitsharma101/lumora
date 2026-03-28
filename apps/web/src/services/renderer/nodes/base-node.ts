import type { CanvasRenderer } from "../canvas-renderer";

export type BaseNodeParams = object | undefined;

export class BaseNode<Params extends BaseNodeParams = BaseNodeParams> {
	params: Params;

	constructor(params?: Params) {
		this.params = params ?? ({} as Params);
	}

	children: BaseNode[] = [];

	add(child: BaseNode) {
		this.children.push(child);
		return this;
	}

	remove(child: BaseNode) {
		this.children = this.children.filter((c) => c !== child);
		return this;
	}

	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		// Children share a single canvas context and must draw in order
		// (back-to-front compositing), so we render sequentially.
		// However, skip iteration overhead for common cases.
		const len = this.children.length;
		if (len === 0) return;
		if (len === 1) {
			await this.children[0].render({ renderer, time });
			return;
		}
		for (let i = 0; i < len; i++) {
			await this.children[i].render({ renderer, time });
		}
	}
}
