"use client";

import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { Handlebars } from "./handlebars";
import Link from "next/link";
import { motion } from "motion/react";

export function Hero() {
	return (
		<div className="relative flex flex-col items-center px-6 pt-32 pb-16 text-center md:pt-40 md:pb-24">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.6, ease: "easeOut" }}
				className="mx-auto flex w-full max-w-4xl flex-col items-center"
			>
				<div className="inline-block text-5xl font-bold tracking-tighter md:text-7xl">
					<h1>An agentic</h1>
					<Handlebars>Video editing platform</Handlebars>
				</div>

				<p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-lg font-light tracking-wide md:text-xl">
					Go from raw footage to a clean, publish-ready edit in minutes.
					AI-powered, and runs in your browser.
				</p>

				<div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
					<Link href="/projects">
						<Button
							variant="foreground"
							size="lg"
							className="h-12 px-8 text-base"
						>
							Get started
							<ArrowRight className="ml-1 size-4" />
						</Button>
					</Link>
				</div>
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: 40 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
				className="relative mt-16 w-full max-w-5xl md:mt-24"
			>
				<div className="absolute -inset-4 rounded-2xl bg-blue-500/10 blur-3xl" />
				<div className="relative overflow-hidden rounded-xl border border-white/10">
					<Image
						src="/landing-page-dark.png"
						width={1903}
						height={1269}
						alt="Grace Studio video editor interface"
						className="w-full"
						priority
					/>
				</div>
			</motion.div>
		</div>
	);
}
