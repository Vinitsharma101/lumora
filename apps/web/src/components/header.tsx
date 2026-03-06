"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "./ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import { Menu02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";
import { DEFAULT_LOGO_URL } from "@/constants/site-constants";

export function Header() {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const closeMenu = () => setIsMenuOpen(false);

	const links = [
		{
			label: "Blog",
			href: "/blog",
		},
	];

	return (
		<header className="bg-background/80 sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl">
			<div className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
				<div className="relative z-10 flex items-center gap-6">
					<Link href="/" className="flex items-center gap-2.5">
						<Image
							src={DEFAULT_LOGO_URL}
							alt="GraceCut Logo"
							className="invert dark:invert-0"
							width={28}
							height={28}
						/>
						<span className="text-sm font-semibold">GraceCut</span>
					</Link>
					<nav className="hidden items-center gap-1 md:flex">
						{links.map((link) => (
							<Link key={link.href} href={link.href}>
								<Button
									variant="ghost"
									className="text-muted-foreground hover:text-foreground h-8 px-3 text-sm"
								>
									{link.label}
								</Button>
							</Link>
						))}
					</nav>
				</div>

				<div className="relative z-10">
					<div className="flex items-center gap-3 md:hidden">
						<Button
							variant="ghost"
							size="icon"
							className="flex items-center justify-center"
							onClick={() => setIsMenuOpen(!isMenuOpen)}
						>
							<HugeiconsIcon icon={Menu02Icon} size={24} />
						</Button>
					</div>
					<div className="hidden items-center gap-2 md:flex">
						<Link href="/projects">
							<Button
								variant="foreground"
								className="h-8 px-4 text-sm"
							>
								Get started
								<ArrowRight className="size-3.5" />
							</Button>
						</Link>
						<ThemeToggle />
					</div>
				</div>
				<div
					className={cn(
						"bg-background/20 pointer-events-none fixed inset-0 z-40 opacity-0 backdrop-blur-3xl",
						"transition-opacity duration-150",
						isMenuOpen && "pointer-events-auto opacity-100",
					)}
				>
					<div className="relative h-full">
						<button
							type="button"
							aria-label="Close menu"
							className="absolute inset-0"
							onClick={closeMenu}
							onKeyDown={(event) => {
								if (
									event.key === "Enter" ||
									event.key === " " ||
									event.key === "Escape"
								) {
									event.preventDefault();
									closeMenu();
								}
							}}
						/>
						<nav className="flex flex-col gap-3 px-6 pt-[5rem]">
							{links.map((link, index) => (
								<motion.div
									key={link.href}
									initial={{ scale: 0.98, opacity: 0 }}
									animate={{
										scale: isMenuOpen ? 1 : 0.98,
										opacity: isMenuOpen ? 1 : 0,
									}}
									transition={{
										duration: 0.4,
										delay: isMenuOpen ? index * 0.1 : 0,
										ease: [0.25, 0.46, 0.45, 0.94],
									}}
								>
									<Link
										href={link.href}
										className="text-2xl font-semibold"
										onClick={() => setIsMenuOpen(false)}
									>
										{link.label}
									</Link>
								</motion.div>
							))}
						</nav>
						<ThemeToggle
							className="absolute right-8 bottom-8 size-10"
							iconClassName="!size-[1.2rem]"
							onToggle={(e) => {
								e.preventDefault();
								e.stopPropagation();
							}}
						/>
					</div>
				</div>
			</div>
		</header>
	);
}
