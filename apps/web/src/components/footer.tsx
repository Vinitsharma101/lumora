import Link from "next/link";
import { RiDiscordFill, RiTwitterXLine } from "react-icons/ri";
import { FaGithub } from "react-icons/fa6";
import Image from "next/image";
import {
	DEFAULT_LOGO_URL,
	EXTERNAL_TOOLS,
	SOCIAL_LINKS,
} from "@/constants/site-constants";

const footerLinks = {
	Product: [
		{ label: "Editor", href: "/projects" },
		{ label: "AI Features", href: "/projects" },
		{ label: "Sponsors", href: "/sponsors" },
		{ label: "Blog", href: "/blog" },
	],
	Resources: [
		{
			label: "Documentation",
			href: `${SOCIAL_LINKS.github}/blob/main/README.md`,
		},
		{ label: "Roadmap", href: "/roadmap" },
		{ label: "Branding", href: "/branding" },
		{ label: "Contributors", href: "/contributors" },
	],
	Legal: [
		{ label: "Privacy", href: "/privacy" },
		{ label: "Terms of Use", href: "/terms" },
	],
};

export function Footer() {
	return (
		<footer className="border-t border-white/10">
			<div className="mx-auto max-w-6xl px-6 py-16">
				<div className="grid grid-cols-2 gap-12 md:grid-cols-4">
					{/* Brand */}
					<div className="col-span-2 md:col-span-1">
						<div className="mb-4 flex items-center gap-2.5">
							<Image
								src={DEFAULT_LOGO_URL}
								alt="OpenCut"
								width={24}
								height={24}
								className="invert dark:invert-0"
							/>
							<span className="font-semibold">OpenCut</span>
						</div>
						<p className="text-muted-foreground mb-5 max-w-xs text-sm leading-relaxed">
							The open source video editor powered by AI. Free,
							fast, and runs in your browser.
						</p>
						<div className="flex gap-3">
							<Link
								href={SOCIAL_LINKS.github}
								className="text-muted-foreground hover:text-foreground transition-colors"
								target="_blank"
								rel="noopener noreferrer"
							>
								<FaGithub className="size-5" />
							</Link>
							<Link
								href={SOCIAL_LINKS.x}
								className="text-muted-foreground hover:text-foreground transition-colors"
								target="_blank"
								rel="noopener noreferrer"
							>
								<RiTwitterXLine className="size-5" />
							</Link>
							<Link
								href={SOCIAL_LINKS.discord}
								className="text-muted-foreground hover:text-foreground transition-colors"
								target="_blank"
								rel="noopener noreferrer"
							>
								<RiDiscordFill className="size-5" />
							</Link>
						</div>
					</div>

					{/* Link columns */}
					{Object.entries(footerLinks).map(([category, links]) => (
						<div key={category}>
							<h3 className="text-foreground mb-3 text-sm font-semibold">
								{category}
							</h3>
							<ul className="space-y-2.5 text-sm">
								{links.map((link) => (
									<li key={`${category}-${link.label}`}>
										<Link
											href={link.href}
											className="text-muted-foreground hover:text-foreground transition-colors"
											target={
												link.href.startsWith("http")
													? "_blank"
													: undefined
											}
											rel={
												link.href.startsWith("http")
													? "noopener noreferrer"
													: undefined
											}
										>
											{link.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				{/* Built with */}
				<div className="mt-12 border-t border-white/10 pt-8">
					<div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
						<div className="text-muted-foreground text-sm">
							© {new Date().getFullYear()} OpenCut. All rights
							reserved.
						</div>
						<div className="flex items-center gap-4">
							<span className="text-muted-foreground text-xs">
								Built with
							</span>
							{EXTERNAL_TOOLS.map((tool) => (
								<Link
									key={tool.name}
									href={tool.url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
								>
									<tool.icon className="size-4" />
									{tool.name}
								</Link>
							))}
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
