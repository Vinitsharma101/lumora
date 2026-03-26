"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { SectionWrapper } from "./section-wrapper";

export function CTASection() {
	return (
		<SectionWrapper className="text-center">
			<div className="relative mx-auto max-w-3xl">
				<div className="absolute -inset-24 rounded-full bg-blue-500/5 blur-3xl" />
				<div className="relative">
					<h2 className="text-3xl font-bold tracking-tight md:text-5xl">
						Start editing for free
					</h2>
					<p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">
						No credit card required. AI-powered editing runs in your
						browser.
					</p>
					<div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
						<Link href="/home">
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
				</div>
			</div>
		</SectionWrapper>
	);
}
