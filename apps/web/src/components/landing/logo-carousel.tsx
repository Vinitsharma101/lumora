"use client";

import Image from "next/image";
import { SPONSORS } from "@/constants/site-constants";
import { SectionWrapper } from "./section-wrapper";

const logos = [
	...SPONSORS,
	{ name: "Next.js", logo: "/logos/others/vercel.svg" },
	...SPONSORS,
	{ name: "Next.js", logo: "/logos/others/vercel.svg" },
];

export function LogoCarousel() {
	return (
		<SectionWrapper className="py-16 md:py-20">
			<p className="text-muted-foreground mb-10 text-center text-sm font-medium uppercase tracking-widest">
				Backed by
			</p>
			<div className="relative overflow-hidden">
				<div className="absolute top-0 left-0 z-10 h-full w-24 bg-gradient-to-r from-black to-transparent" />
				<div className="absolute top-0 right-0 z-10 h-full w-24 bg-gradient-to-l from-black to-transparent" />
				<div className="flex animate-scroll gap-16">
					{[...logos, ...logos].map((logo, i) => (
						<div
							key={`${logo.name}-${i}`}
							className="flex shrink-0 items-center justify-center opacity-50 grayscale transition-all hover:opacity-100 hover:grayscale-0"
						>
							<Image
								src={logo.logo}
								alt={logo.name}
								width={120}
								height={40}
								className="h-8 w-auto invert"
							/>
						</div>
					))}
				</div>
			</div>
		</SectionWrapper>
	);
}
