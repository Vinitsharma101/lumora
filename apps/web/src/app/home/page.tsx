"use client";

import { useState, useEffect, Suspense } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { HomeChat } from "@/components/home/home-chat";
import { ProjectsSection } from "@/components/home/projects-section";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ImageIcon, Video } from "lucide-react";
import { cn } from "@/utils/ui";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

type HomeMode = "image" | "video";

function HomeContent() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	
	const modeParam = searchParams.get("mode") as HomeMode | null;
	const [mode, setMode] = useState<HomeMode>(modeParam === "image" ? "image" : "video");

	useEffect(() => {
		if (modeParam === "image" || modeParam === "video") {
			setMode(modeParam);
		}
	}, [modeParam]);

	const handleModeChange = (newMode: HomeMode) => {
		setMode(newMode);
		const params = new URLSearchParams(searchParams.toString());
		params.set("mode", newMode);
		router.replace(`${pathname}?${params.toString()}`);
	};

	return (
		<div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
			<Header />

			<main className="flex-1 flex flex-col">
				<div className="w-full max-w-[1400px] mx-auto px-4 md:px-8 pt-12 md:pt-20 lg:pt-28 flex flex-col items-center">
					
					{/* Mode Toggle */}
					<div className="mb-12">
						<ToggleGroup
							type="single"
							value={mode}
							onValueChange={(value) => {
								if (value) handleModeChange(value as HomeMode);
							}}
							className="bg-muted p-1 rounded-full shadow-inner"
						>
							<ToggleGroupItem
								value="image"
								aria-label="Toggle Image mode"
								className={cn(
									"rounded-full px-6 py-2 h-10 gap-2 transition-all data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary",
								)}
							>
								<ImageIcon className="size-4" />
								<span className="font-medium">Image</span>
							</ToggleGroupItem>
							<ToggleGroupItem
								value="video"
								aria-label="Toggle Video mode"
								className={cn(
									"rounded-full px-6 py-2 h-10 gap-2 transition-all data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary",
								)}
							>
								<Video className="size-4" />
								<span className="font-medium">Video</span>
							</ToggleGroupItem>
						</ToggleGroup>
					</div>

					{/* Title Output */}
					<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-center mb-8">
						What do you want to create?
					</h1>

					{/* Chat Interface */}
					<div className="w-full flex justify-center mb-16">
						<HomeChat mode={mode} className="w-full max-w-3xl" />
					</div>
				</div>

				{/* Projects Section */}
				<div className="bg-muted/10 w-full border-t border-border/40 py-8">
					<ProjectsSection mode={mode} />
				</div>
				
				{/* Community Section Placeholder */}
				<div className="w-full border-t border-border/40 py-16">
					<div className="max-w-[1400px] mx-auto px-4 md:px-8">
						<h2 className="text-2xl font-semibold tracking-tight mb-8">Community Gallery</h2>
						<div className="py-20 text-center flex flex-col items-center justify-center bg-muted/20 border border-dashed rounded-xl">
							<p className="text-muted-foreground">Community templates coming soon.</p>
						</div>
					</div>
				</div>
			</main>

			<Footer />
		</div>
	);
}

export default function HomePage() {
	return (
		<Suspense fallback={<div className="min-h-screen bg-background" />}>
			<HomeContent />
		</Suspense>
	);
}
