"use client";

import { motion } from "motion/react";
import { SectionWrapper } from "./section-wrapper";
import {
	MessageSquare,
	Captions,
	Music,
	Layers,
	Search,
	Bot,
} from "lucide-react";

const features = [
	{
		icon: MessageSquare,
		title: "AI Chat Assistant",
		description:
			"Describe your edit in plain English. Our AI assistant understands your vision and executes complex edits for you.",
		span: "lg:col-span-2",
	},
	{
		icon: Captions,
		title: "Auto Captions",
		description:
			"Generate and style captions instantly with AI-powered transcription. Customize fonts, animations, and positioning.",
		span: "lg:col-span-1",
	},
	{
		icon: Music,
		title: "AI Voice & Music",
		description:
			"Generate voiceovers and background music with AI. Match the tone and energy of your content automatically.",
		span: "lg:col-span-1",
	},
	{
		icon: Layers,
		title: "Motion Graphics",
		description:
			"Professional lower-thirds, titles, and animations. Drag and drop from a growing template library.",
		span: "lg:col-span-1",
	},
	{
		icon: Search,
		title: "Stock Media Search",
		description:
			"Find the perfect clip, image, or sound effect without leaving the editor. Millions of assets at your fingertips.",
		span: "lg:col-span-1",
	},
	{
		icon: Bot,
		title: "Agentic AI Pipeline",
		description:
			"Autonomous AI agents that handle video generation, rendering, and effects. Describe what you want, and the agents deliver.",
		span: "lg:col-span-2",
	},
];

export function Features() {
	return (
		<SectionWrapper>
			<div className="mb-16 text-center">
				<h2 className="text-3xl font-bold tracking-tight md:text-5xl">
					An editor with superpowers
				</h2>
				<p className="text-muted-foreground mt-4 text-lg">
					Everything you need to create professional videos, powered
					by AI.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{features.map((feature, i) => (
					<motion.div
						key={feature.title}
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{
							duration: 0.4,
							delay: i * 0.08,
							ease: "easeOut",
						}}
						className={`group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-8 transition-colors hover:border-white/20 hover:bg-white/[0.05] ${feature.span}`}
					>
						<feature.icon className="text-muted-foreground size-8 transition-colors group-hover:text-blue-400" />
						<h3 className="mt-4 text-xl font-semibold">
							{feature.title}
						</h3>
						<p className="text-muted-foreground mt-2 max-w-lg text-sm leading-relaxed">
							{feature.description}
						</p>
					</motion.div>
				))}
			</div>
		</SectionWrapper>
	);
}
