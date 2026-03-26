"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEditor } from "@/hooks/use-editor";
import { Film, ImageIcon, Smartphone } from "lucide-react";

const QUICK_CREATE_OPTIONS = [
	{
		id: "video",
		label: "Create Video",
		description: "YouTube, ads, promos",
		icon: Film,
		type: "video" as const,
		defaultPrompt: "Create a professional video",
		canvasPreset: { width: 1920, height: 1080 },
	},
	{
		id: "reel",
		label: "Create Reel",
		description: "TikTok, Shorts, Stories",
		icon: Smartphone,
		type: "video" as const,
		defaultPrompt: "Create a short-form vertical reel",
		canvasPreset: { width: 1080, height: 1920 },
	},
	{
		id: "image",
		label: "Create Image",
		description: "Thumbnails, posters, art",
		icon: ImageIcon,
		type: "image" as const,
		defaultPrompt: "Create an image",
		canvasPreset: { width: 1920, height: 1080 },
	},
] as const;

export function QuickCreateButtons() {
	const [loadingId, setLoadingId] = useState<string | null>(null);
	const editor = useEditor();
	const router = useRouter();

	const handleQuickCreate = async (
		option: (typeof QUICK_CREATE_OPTIONS)[number],
	) => {
		if (loadingId) return;
		setLoadingId(option.id);

		try {
			const projectId = await editor.project.createNewProject({
				name: option.label,
				type: option.type,
			});

			const route =
				option.type === "image"
					? `/images/${projectId}`
					: `/editor/${projectId}`;
			router.push(route);
		} catch (error) {
			toast.error("Failed to create project", {
				description:
					error instanceof Error ? error.message : "Please try again",
			});
		} finally {
			setLoadingId(null);
		}
	};

	return (
		<div className="flex items-center gap-3 flex-wrap justify-center">
			{QUICK_CREATE_OPTIONS.map((option) => {
				const Icon = option.icon;
				const isLoading = loadingId === option.id;

				return (
					<button
						key={option.id}
						type="button"
						disabled={loadingId !== null}
						onClick={() => handleQuickCreate(option)}
						className="group flex items-center gap-3 px-5 py-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<div className="flex items-center justify-center size-9 rounded-lg bg-foreground/5 group-hover:bg-foreground/10 transition-colors">
							<Icon className="size-4.5 text-foreground/70" />
						</div>
						<div className="text-left">
							<div className="text-sm font-medium text-foreground">
								{isLoading ? "Creating..." : option.label}
							</div>
							<div className="text-xs text-muted-foreground">
								{option.description}
							</div>
						</div>
					</button>
				);
			})}
		</div>
	);
}
