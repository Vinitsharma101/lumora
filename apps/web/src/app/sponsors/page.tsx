import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";

export const metadata: Metadata = {
	title: "Sponsors - Grace Studio",
	description:
		"Support Grace Studio and help us build the future of AI-powered video editing.",
	openGraph: {
		title: "Sponsors - Grace Studio",
		description:
			"Support Grace Studio and help us build the future of AI-powered video editing.",
		type: "website",
	},
};

export default function SponsorsPage() {
	return (
		<BasePage>
			<div className="flex flex-col gap-8 text-center">
				<h1 className="text-5xl font-bold tracking-tight md:text-6xl">
					Sponsors
				</h1>
				<p className="text-muted-foreground mx-auto max-w-2xl text-xl leading-relaxed text-pretty">
					No sponsors at this time. Interested in partnering with Grace Studio?
					Reach out to us.
				</p>
			</div>
		</BasePage>
	);
}
