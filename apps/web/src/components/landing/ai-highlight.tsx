"use client";

import { motion } from "motion/react";
import { SectionWrapper } from "./section-wrapper";

const chatLines = [
	{
		role: "user" as const,
		text: '"Add captions for the entire video and a subscribe animation at the end"',
	},
	{
		role: "ai" as const,
		text: "Planning edits...",
	},
	{
		role: "ai-step" as const,
		text: "✓ Generated 24 captions from transcript",
	},
	{
		role: "ai-step" as const,
		text: "✓ Added subscribe CTA at 2:45",
	},
	{
		role: "ai-done" as const,
		text: "Done! 2 operations completed.",
	},
];

export function AIHighlight() {
	return (
		<SectionWrapper>
			<div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
				<div>
					<h2 className="text-3xl font-bold tracking-tight md:text-5xl">
						Edit with words,
						<br />
						not clicks
					</h2>
					<p className="text-muted-foreground mt-6 text-lg leading-relaxed">
						Describe what you want in plain English. The AI
						assistant handles the rest — from generating captions
						to adding animations, transitions, and effects.
					</p>
					<ul className="text-muted-foreground mt-8 space-y-3 text-sm">
						<li className="flex items-center gap-2">
							<span className="text-blue-400">→</span>
							Natural language editing commands
						</li>
						<li className="flex items-center gap-2">
							<span className="text-blue-400">→</span>
							Batch operations in seconds
						</li>
						<li className="flex items-center gap-2">
							<span className="text-blue-400">→</span>
							Undo anything, tweak everything
						</li>
					</ul>
				</div>

				<motion.div
					initial={{ opacity: 0, x: 20 }}
					whileInView={{ opacity: 1, x: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, ease: "easeOut" }}
					className="relative"
				>
					<div className="absolute -inset-4 rounded-2xl bg-blue-500/5 blur-2xl" />
					<div className="relative overflow-hidden rounded-xl border border-white/10 bg-black p-6 font-mono text-sm">
						<div className="mb-4 flex items-center gap-2">
							<div className="size-3 rounded-full bg-white/10" />
							<div className="size-3 rounded-full bg-white/10" />
							<div className="size-3 rounded-full bg-white/10" />
						</div>
						<div className="space-y-3">
							{chatLines.map((line, i) => (
								<motion.div
									key={i}
									initial={{ opacity: 0 }}
									whileInView={{ opacity: 1 }}
									viewport={{ once: true }}
									transition={{
										duration: 0.3,
										delay: 0.4 + i * 0.15,
									}}
								>
									{line.role === "user" && (
										<div className="text-blue-400">
											<span className="text-muted-foreground">
												You:{" "}
											</span>
											{line.text}
										</div>
									)}
									{line.role === "ai" && (
										<div className="text-muted-foreground mt-2">
											AI: {line.text}
										</div>
									)}
									{line.role === "ai-step" && (
										<div className="text-emerald-400 pl-8">
											{line.text}
										</div>
									)}
									{line.role === "ai-done" && (
										<div className="text-foreground mt-1 pl-8 font-semibold">
											{line.text}
										</div>
									)}
								</motion.div>
							))}
						</div>
					</div>
				</motion.div>
			</div>
		</SectionWrapper>
	);
}
