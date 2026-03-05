"use client";

import { motion } from "motion/react";
import { SectionWrapper } from "./section-wrapper";

const useCases = [
	{
		icon: "🎙",
		title: "Talking Heads",
		description:
			"AI-powered captions and framing in seconds. Perfect for interviews and vlogs.",
	},
	{
		icon: "📱",
		title: "Short-form Content",
		description:
			"Automatically create TikToks, Reels, and Shorts from long-form content.",
	},
	{
		icon: "🎧",
		title: "Podcasts",
		description:
			"Pull the best moments and clip them for social. Multi-track audio editing.",
	},
	{
		icon: "📚",
		title: "Tutorials & Explainers",
		description:
			"Add titles, lower-thirds, and motion graphics with ease.",
	},
	{
		icon: "🎵",
		title: "Music Videos",
		description:
			"Beat-synced cuts with AI music generation. Visual effects made simple.",
	},
	{
		icon: "🔓",
		title: "Open Source & Extensible",
		description:
			"Fully hackable. Build plugins, self-host, and own your workflow.",
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
					Whatever you&apos;re making, OpenCut has you covered.
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
