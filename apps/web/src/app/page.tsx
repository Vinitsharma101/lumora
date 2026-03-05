import { Hero } from "@/components/landing/hero";
import { LogoCarousel } from "@/components/landing/logo-carousel";
import { UseCases } from "@/components/landing/use-cases";
import { Features } from "@/components/landing/features";
import { AIHighlight } from "@/components/landing/ai-highlight";
import { Community } from "@/components/landing/community";
import { CTASection } from "@/components/landing/cta-section";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import type { Metadata } from "next";
import { SITE_URL } from "@/constants/site-constants";

export const metadata: Metadata = {
	alternates: {
		canonical: SITE_URL,
	},
};

export default async function Home() {
	return (
		<div className="dark bg-[hsl(0,0%,5%)] text-[hsl(0,0%,87%)]">
			<Header />
			<Hero />
			<LogoCarousel />
			<UseCases />
			<Features />
			<AIHighlight />
			<Community />
			<CTASection />
			<Footer />
		</div>
	);
}
