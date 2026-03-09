"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useEditor } from "@/hooks/use-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar04Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { Video, ImageIcon } from "lucide-react";
import { formatDate } from "@/utils/date";
import type { TProjectMetadata } from "@/types/project";
import { formatTimeCode } from "@/lib/time";

const formatProjectDuration = ({
	duration,
}: {
	duration: number | undefined;
}): string | null => {
	if (duration === undefined) {
		return null;
	}

	const format = duration >= 3600 ? "HH:MM:SS" : "MM:SS";
	return formatTimeCode({ timeInSeconds: duration, format });
};

interface ProjectsSectionProps {
	mode: "image" | "video";
}

export function ProjectsSection({ mode }: ProjectsSectionProps) {
	const editor = useEditor();
	const router = useRouter();
	const [projects, setProjects] = useState<TProjectMetadata[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadProjects = async () => {
			if (!editor.project.getIsInitialized()) {
				await editor.project.loadAllProjects();
			}
			setProjects(editor.project.getSavedProjects());
			setIsLoading(false);
		};

		loadProjects();
		
		const unsubscribe = editor.project.subscribe(() => {
			setProjects(editor.project.getSavedProjects());
		});
		
		return unsubscribe;
	}, [editor.project]);

	// Video mode shows projects with type === undefined or "video".
	// Image mode shows projects with type === "image".
	const filteredProjects = projects.filter((project) => {
		if (mode === "image") {
			return project.type === "image";
		}
		return project.type === "video" || project.type === undefined;
	});

	// Only show the top 8 recent projects
	const recentProjects = filteredProjects
		.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
		.slice(0, 8);

	const handleCreateNew = async () => {
		try {
			const projectId = await editor.project.createNewProject({
				name: "New Project",
				type: mode,
			});
			if (mode === "image") {
				router.push(`/images/${projectId}`);
			} else {
				router.push(`/editor/${projectId}`);
			}
		} catch (error) {
			console.error(`Failed to create ${mode} project:`, error);
		}
	};

	return (
		<div className="w-full flex flex-col gap-6 mt-12 mb-20 px-4 md:px-8 max-w-[1400px] mx-auto">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-semibold tracking-tight">Your Projects</h2>
				<Button onClick={handleCreateNew} className="gap-2">
					<HugeiconsIcon icon={PlusSignIcon} className="size-4" />
					<span className="hidden sm:inline">New {mode === "image" ? "Image" : "Video"}</span>
				</Button>
			</div>

			{isLoading ? (
				<div className="text-muted-foreground text-sm">Loading projects...</div>
			) : recentProjects.length === 0 ? (
				<div className="py-12 text-center flex flex-col items-center justify-center bg-muted/20 border border-dashed rounded-xl">
					<p className="text-muted-foreground mb-4">You have no {mode} projects yet.</p>
					<Button variant="outline" onClick={handleCreateNew}>
						Create your first {mode}
					</Button>
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					{recentProjects.map((project) => (
						<ProjectCard key={project.id} project={project} />
					))}
				</div>
			)}
		</div>
	);
}

function ProjectCard({ project }: { project: TProjectMetadata }) {
	const linkTarget = project.type === "image" ? `/images/${project.id}` : `/editor/${project.id}`;
	const durationLabel = project.type !== "image" ? formatProjectDuration({ duration: project.duration }) : null;

	return (
		<Link href={linkTarget} className="block group">
			<Card className="bg-background overflow-hidden border-border/50 hover:border-border/80 transition-colors cursor-pointer p-0 h-full flex flex-col">
				<div className="bg-muted relative aspect-video flex-shrink-0">
					<div className="absolute inset-0">
						{project.thumbnail ? (
							<Image
								src={project.thumbnail}
								alt="Project thumbnail"
								fill
								className="object-cover group-hover:scale-105 transition-transform duration-500"
							/>
						) : (
							<div className="flex size-full items-center justify-center group-hover:scale-105 transition-transform duration-500">
								{project.type === "image" ? (
									<ImageIcon className="text-muted-foreground/50 size-10 shrink-0" />
								) : (
									<Video className="text-muted-foreground/50 size-10 shrink-0" />
								)}
							</div>
						)}
					</div>

					{durationLabel && (
						<div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-sm shadow-sm">
							{durationLabel}
						</div>
					)}
				</div>

				<CardContent className="flex flex-col gap-1.5 p-4 flex-grow">
					<h3 className="group-hover:text-foreground/90 line-clamp-2 text-base leading-tight font-medium">
						{project.name}
					</h3>
					<div className="text-muted-foreground flex items-center gap-1.5 text-xs opacity-80 mt-auto">
						<HugeiconsIcon icon={Calendar04Icon} className="size-3.5" />
						<span>{formatDate({ date: project.createdAt })}</span>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}
