"use client";

import Link from "next/link";
import { SOCIAL_LINKS } from "@/constants/site-constants";
import { SectionWrapper } from "./section-wrapper";
import { FaGithub } from "react-icons/fa6";
import { RiDiscordFill, RiTwitterXLine } from "react-icons/ri";

const stats = [
	{ label: "GitHub Stars", value: "40k+" },
	{ label: "Contributors", value: "400+" },
	{ label: "Forks", value: "6k+" },
];

const socialLinks = [
	{
		label: "GitHub",
		href: SOCIAL_LINKS.github,
		icon: FaGithub,
		description: "Star us, fork us, contribute",
	},
	{
		label: "Discord",
		href: SOCIAL_LINKS.discord,
		icon: RiDiscordFill,
		description: "Join the community chat",
	},
	{
		label: "X / Twitter",
		href: SOCIAL_LINKS.x,
		icon: RiTwitterXLine,
		description: "Follow for updates",
	},
];

export function Community() {
	return (
		<SectionWrapper>
			<div className="text-center">
				<h2 className="text-3xl font-bold tracking-tight md:text-5xl">
					Built in the open
				</h2>
				<p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
					OpenCut is free and open source, shaped by a growing
					community of developers and creators.
				</p>
			</div>

			<div className="mt-16 grid grid-cols-3 gap-4">
				{stats.map((stat) => (
					<div
						key={stat.label}
						className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center"
					>
						<div className="text-3xl font-bold md:text-4xl">
							{stat.value}
						</div>
						<div className="text-muted-foreground mt-1 text-sm">
							{stat.label}
						</div>
					</div>
				))}
			</div>

			<div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
				{socialLinks.map((link) => (
					<Link
						key={link.label}
						href={link.href}
						target="_blank"
						rel="noopener noreferrer"
						className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
					>
						<link.icon className="size-6 shrink-0" />
						<div>
							<div className="font-medium">{link.label}</div>
							<div className="text-muted-foreground text-sm">
								{link.description}
							</div>
						</div>
					</Link>
				))}
			</div>
		</SectionWrapper>
	);
}
