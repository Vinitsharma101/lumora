"use client";

import { SectionWrapper } from "./section-wrapper";
import { Bot, Layers, Zap, Sparkles, Film, Palette } from "lucide-react";

const capabilities = [
	{
		icon: Bot,
		title: "Agentic AI Pipeline",
		description: "AI agents that understand your creative vision and execute complex edits autonomously.",
	},
	{
		icon: Zap,
		title: "Real-time Processing",
		description: "Instant previews and rendering powered by optimized cloud infrastructure.",
	},
	{
		icon: Layers,
		title: "Multi-track Editing",
		description: "Professional timeline with unlimited video, audio, and effects tracks.",
	},
	{
		icon: Sparkles,
		title: "AI Voice & Music",
		description: "Generate voiceovers and background music that match your content automatically.",
	},
	{
		icon: Film,
		title: "Smart Captions",
		description: "AI-powered transcription with customizable styles, fonts, and animations.",
	},
	{
		icon: Palette,
		title: "Motion Graphics",
		description: "Professional titles, lower-thirds, and animations from a growing template library.",
	},
];

export function Community() {
	return (
		<SectionWrapper>
			<div className="text-center">
				<h2 className="text-3xl font-bold tracking-tight md:text-5xl">
					Platform Capabilities
				</h2>
				<p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
					GraceCut combines powerful editing tools with an agentic AI
					pipeline to transform your creative workflow.
				</p>
			</div>

			<div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{capabilities.map((item) => (
					<div
						key={item.title}
						className="group flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
					>
						<item.icon className="size-6 shrink-0 text-blue-400" />
						<div>
							<div className="font-medium">{item.title}</div>
							<div className="text-muted-foreground mt-1 text-sm">
								{item.description}
							</div>
						</div>
					</div>
				))}
			</div>
		</SectionWrapper>
	);
}
