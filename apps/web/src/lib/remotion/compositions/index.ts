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
}

export const COMPOSITION_REGISTRY: Record<string, CompositionEntry> = {
	"lower-third": {
		component: LowerThird,
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
		defaultProps: {
			channelName: "Subscribe",
			accentColor: "#FF0000",
		} satisfies SubscribeCTAProps,
		defaultDurationInFrames: 120,
	},
	countdown: {
		component: Countdown,
		defaultProps: {
			from: 3,
			color: "#ffffff",
			background: "#000000",
		} satisfies CountdownProps,
		defaultDurationInFrames: 90,
	},
	"text-reveal": {
		component: TextReveal,
		defaultProps: {
			text: "Your Text Here",
			color: "#ffffff",
			background: "#000000",
			fontSize: 64,
		} satisfies TextRevealProps,
		defaultDurationInFrames: 90,
	},
};
