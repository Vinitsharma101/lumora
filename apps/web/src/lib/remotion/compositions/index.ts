import type React from "react";
import { LowerThird, type LowerThirdProps } from "./lower-third";
import { TitleCard, type TitleCardProps } from "./title-card";
import { SubscribeCTA, type SubscribeCTAProps } from "./subscribe-cta";
import { Countdown, type CountdownProps } from "./countdown";
import { TextReveal, type TextRevealProps } from "./text-reveal";

export interface CompositionEntry {
	// biome-ignore lint: component accepts varying props
	component: React.FC<any>;
	defaultProps: Record<string, unknown>;
	defaultDurationInFrames: number;
	width?: number;
	height?: number;
	fps?: number;
}

export const COMPOSITION_REGISTRY: Record<string, CompositionEntry> = {
	"lower-third": {
		component: LowerThird,
		width: 1920,
		height: 1080,
		fps: 30,
		defaultProps: {
			primaryText: "Name",
			secondaryText: "Title",
			accentColor: "#7C3AED",
			textColor: "#ffffff",
		} satisfies LowerThirdProps,
		defaultDurationInFrames: 150,
	},
	"title-card": {
		component: TitleCard,
		width: 1920,
		height: 1080,
		fps: 30,
		defaultProps: {
			title: "Title",
			subtitle: "",
			background: "#000000",
			textColor: "#ffffff",
		} satisfies TitleCardProps,
		defaultDurationInFrames: 120,
	},
	"subscribe-cta": {
		component: SubscribeCTA,
		width: 1920,
		height: 1080,
		fps: 30,
		defaultProps: {
			channelName: "Subscribe",
			accentColor: "#FF0000",
		} satisfies SubscribeCTAProps,
		defaultDurationInFrames: 120,
	},
	countdown: {
		component: Countdown,
		width: 1920,
		height: 1080,
		fps: 30,
		defaultProps: {
			from: 3,
			color: "#ffffff",
			background: "#000000",
		} satisfies CountdownProps,
		defaultDurationInFrames: 90,
	},
	"text-reveal": {
		component: TextReveal,
		width: 1920,
		height: 1080,
		fps: 30,
		defaultProps: {
			text: "Your Text Here",
			color: "#ffffff",
			background: "#000000",
			fontSize: 64,
		} satisfies TextRevealProps,
		defaultDurationInFrames: 90,
	},
};

export function getCompositionEntry(
	compositionId: string,
): CompositionEntry | null {
	return COMPOSITION_REGISTRY[compositionId] ?? null;
}

export function getDefaultCompositionProps(
	compositionId: string,
): Record<string, unknown> {
	return getCompositionEntry(compositionId)?.defaultProps ?? {};
}

export function getDefaultCompositionDuration(
	compositionId: string,
): number | null {
	return getCompositionEntry(compositionId)?.defaultDurationInFrames ?? null;
}

export function getCompositionDimensions(compositionId: string): {
	width: number;
	height: number;
	fps: number;
} {
	const entry = getCompositionEntry(compositionId);
	return {
		width: entry?.width ?? 1920,
		height: entry?.height ?? 1080,
		fps: entry?.fps ?? 30,
	};
}

export function resolveCompositionRenderConfig(
	compositionId: string,
	overrides?: {
		width?: number;
		height?: number;
		fps?: number;
		durationInFrames?: number;
		props?: Record<string, unknown>;
	},
): {
	width: number;
	height: number;
	fps: number;
	durationInFrames: number;
	props: Record<string, unknown>;
} {
	const dimensions = getCompositionDimensions(compositionId);
	return {
		width: overrides?.width ?? dimensions.width,
		height: overrides?.height ?? dimensions.height,
		fps: overrides?.fps ?? dimensions.fps,
		durationInFrames:
			overrides?.durationInFrames ??
			getDefaultCompositionDuration(compositionId) ??
			30 * 5,
		props: {
			...getDefaultCompositionProps(compositionId),
			...(overrides?.props ?? {}),
		},
	};
}
