"use client";

import { motion } from "motion/react";
import { SectionWrapper } from "./section-wrapper";

const useCases = [
	{
		icon: "\u{1F399}",
		title: "Talking Heads",
		description:
			"AI-powered captions and framing in seconds. Perfect for interviews and vlogs.",
	},
	{
		icon: "\u{1F4F1}",
		title: "Short-form Content",
		description:
			"Automatically create TikToks, Reels, and Shorts from long-form content.",
	},
	{
		icon: "\u{1F3A7}",
		title: "Podcasts",
		description:
			"Pull the best moments and clip them for social. Multi-track audio editing.",
	},
	{
		icon: "\u{1F4DA}",
		title: "Tutorials & Explainers",
		description:
			"Add titles, lower-thirds, and motion graphics with ease.",
	},
	{
		icon: "\u{1F3B5}",
		title: "Music Videos",
		description:
			"Beat-synced cuts with AI music generation. Visual effects made simple.",
	},
	{
		icon: "\u{1F916}",
		title: "AI-Powered Workflows",
		description:
			"Let AI agents handle repetitive editing tasks while you focus on creativity.",
	},
];

export function UseCases() {
	return (
		<SectionWrapper>
			<div className="mb-16 text-center">
				<h2 className="text-3xl font-bold tracking-tight md:text-5xl">
					First cut to final cut
				</h2>
				<p className="text-muted-foreground mt-4 text-lg">
					Whatever you&apos;re making, GraceCut has you covered.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{useCases.map((useCase, i) => (
					<motion.div
						key={useCase.title}
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{
							duration: 0.4,
							delay: i * 0.08,
							ease: "easeOut",
						}}
						className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
					>
						<span className="text-2xl">{useCase.icon}</span>
						<h3 className="mt-4 text-lg font-semibold">
							{useCase.title}
						</h3>
						<p className="text-muted-foreground mt-2 text-sm leading-relaxed">
							{useCase.description}
						</p>
					</motion.div>
				))}
			</div>
		</SectionWrapper>
	);
}
