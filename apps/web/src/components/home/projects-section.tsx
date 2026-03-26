"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useEditor } from "@/hooks/use-editor";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Video, ImageIcon, Plus, Search } from "lucide-react";
import type { TProjectMetadata } from "@/types/project";
import { cn } from "@/utils/ui";

const getRelativeTime = ({ date }: { date: Date }): string => {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMinutes = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMinutes < 1) return "Just now";
	if (diffMinutes < 60) return `Edited ${diffMinutes}m ago`;
	if (diffHours < 24) return `Edited ${diffHours}h ago`;
	if (diffDays === 1) return "Edited yesterday";
	return `Edited ${diffDays} days ago`;
};

type ProjectFilter = "all" | "shared" | "mine";

export function ProjectsSection() {
	const editor = useEditor();
	const router = useRouter();
	const [projects, setProjects] = useState<TProjectMetadata[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [filter, setFilter] = useState<ProjectFilter>("all");
	const [searchQuery, setSearchQuery] = useState("");

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

	const filteredProjects = projects
		.filter(() => {
			if (filter === "shared") return false;
			return true;
		})
		.filter((project) => {
			if (!searchQuery.trim()) return true;
			return project.name
				.toLowerCase()
				.includes(searchQuery.toLowerCase());
		})
		.sort(
			(a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
		);

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

	const filterTabs: { id: ProjectFilter; label: string }[] = [
		{ id: "all", label: "All" },
		{ id: "shared", label: "Shared" },
		{ id: "mine", label: "Mine" },
	];

	return (
		<div className="w-full flex flex-col gap-4">
			{/* Filter Tabs + Search */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					{filterTabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setFilter(tab.id)}
							className={cn(
								"text-sm font-medium transition-colors pb-0.5",
								filter === tab.id
									? "text-foreground border-b-2 border-foreground"
									: "text-muted-foreground hover:text-foreground/70",
							)}
						>
							{tab.label}
						</button>
					))}
				</div>
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<Input
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						placeholder="Search boards..."
						className="pl-9 h-9 w-48 bg-muted/30 border-border/50 rounded-lg text-sm"
					/>
				</div>
			</div>

			{/* Project Cards Grid */}
			{isLoading ? (
				<div className="text-muted-foreground text-sm">
					Loading projects...
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{/* Create New Card */}
					<button
						type="button"
						onClick={handleCreateNew}
						className="group"
					>
						<Card className="bg-muted/20 border-dashed border-border/50 hover:border-border/80 transition-colors cursor-pointer p-0 h-full flex flex-col items-center justify-center aspect-[4/3] rounded-2xl">
							<Plus className="size-10 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
						</Card>
					</button>

					{filteredProjects.map((project) => (
						<ProjectCard
							key={project.id}
							project={project}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function ProjectCard({ project }: { project: TProjectMetadata }) {
	const linkTarget =
		project.type === "image"
			? `/images/${project.id}`
			: `/editor/${project.id}`;

	return (
		<Link href={linkTarget} className="block group">
			<Card className="bg-muted/20 overflow-hidden border-border/50 hover:border-border/80 transition-colors cursor-pointer p-0 h-full flex flex-col rounded-2xl">
				<div className="relative p-3">
					<div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
						{project.type === "image" ? "Image" : project.name}
					</div>
					<div className="text-[10px] text-muted-foreground mt-0.5">
						{getRelativeTime({ date: project.updatedAt })}
					</div>
				</div>
				<div className="px-3 pb-3 flex-1">
					<div className="grid grid-cols-3 gap-1.5 aspect-[4/3]">
						{project.thumbnail ? (
							<div className="col-span-2 row-span-2 rounded-lg overflow-hidden relative">
								<Image
									src={project.thumbnail}
									alt={project.name}
									fill
									className="object-cover group-hover:scale-105 transition-transform duration-500"
								/>
							</div>
						) : (
							<div className="col-span-2 row-span-2 rounded-lg bg-muted/40 flex items-center justify-center">
								{project.type === "image" ? (
									<ImageIcon className="text-muted-foreground/30 size-8" />
								) : (
									<Video className="text-muted-foreground/30 size-8" />
								)}
							</div>
						)}
						<div className="rounded-lg bg-muted/40" />
						<div className="rounded-lg bg-muted/40" />
						<div className="rounded-lg bg-muted/40" />
					</div>
				</div>
			</Card>
		</Link>
	);
}
