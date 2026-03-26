"use client";

import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { HomeChat } from "@/components/home/home-chat";
import { ProjectsSection } from "@/components/home/projects-section";
import { TemplateGrid } from "@/components/home/template-grid";
import { useEditor } from "@/hooks/use-editor";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
	const editor = useEditor();
	const router = useRouter();

	const handleCreateNew = async () => {
		try {
			const projectId = await editor.project.createNewProject({
				name: "New Project",
				type: "video",
			});
			router.push(`/editor/${projectId}`);
		} catch (error) {
			console.error("Failed to create project:", error);
		}
	};

	return (
		<div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
			<Header />

			<main className="flex-1 flex flex-col">
				{/* Hero + Chat */}
				<div className="w-full max-w-[1400px] mx-auto px-4 md:px-8 pt-12 md:pt-20 flex flex-col items-center">
					<h1 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-6">
						What do you want to create today?
					</h1>

					<HomeChat className="w-full max-w-3xl" />
				</div>

				{/* Template Grid */}
				<div className="w-full max-w-[1400px] mx-auto px-4 md:px-8 mb-12 mt-10">
					<TemplateGrid />
				</div>

				{/* Projects Section */}
				<div className="bg-muted/10 w-full border-t border-border/40 py-8">
					<div className="w-full max-w-[1400px] mx-auto px-4 md:px-8">
						<ProjectsSection />
					</div>
				</div>

				{/* Bottom Create Button */}
				<div className="flex justify-center py-10">
					<Button
						onClick={handleCreateNew}
						className="rounded-full px-8 py-3 h-12 gap-2 bg-foreground text-background hover:bg-foreground/90 shadow-lg"
					>
						<Plus className="size-5" />
					</Button>
				</div>
			</main>

			<Footer />
		</div>
	);
}
