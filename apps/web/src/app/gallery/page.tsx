"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";
import {
	Film,
	ImageIcon,
	ExternalLink,
	Search,
	Grid3X3,
	LayoutList,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShareMenu } from "@/components/share-menu";
import type { TProjectMetadata } from "@/types/project";

type ViewMode = "grid" | "list";
type TypeFilter = "all" | "video" | "image";

export default function GalleryPage() {
	const editor = useEditor();
	const [projects, setProjects] = useState<TProjectMetadata[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

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
		.filter((project) => {
			if (typeFilter === "all") return true;
			return (project.type ?? "video") === typeFilter;
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

	const videoCount = projects.filter(
		(p) => (p.type ?? "video") === "video",
	).length;
	const imageCount = projects.filter((p) => p.type === "image").length;

	return (
		<div className="min-h-screen flex flex-col bg-background text-foreground">
			<Header />

			<main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 py-8">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-2xl font-bold">My Gallery</h1>
						<p className="text-sm text-muted-foreground mt-1">
							{projects.length} creation
							{projects.length !== 1 ? "s" : ""} &middot;{" "}
							{videoCount} video{videoCount !== 1 ? "s" : ""},{" "}
							{imageCount} image{imageCount !== 1 ? "s" : ""}
						</p>
					</div>
					<Link href="/home">
						<Button variant="outline" size="sm">
							Create New
						</Button>
					</Link>
				</div>

				{/* Controls */}
				<div className="flex items-center justify-between gap-4 mb-6">
					<div className="flex items-center gap-2">
						{(["all", "video", "image"] as const).map((type) => (
							<button
								key={type}
								type="button"
								onClick={() => setTypeFilter(type)}
								className={cn(
									"rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize",
									typeFilter === type
										? "bg-foreground text-background"
										: "bg-muted text-muted-foreground hover:bg-muted/80",
								)}
							>
								{type === "all"
									? "All"
									: type === "video"
										? `Videos (${videoCount})`
										: `Images (${imageCount})`}
							</button>
						))}
					</div>

					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
							<Input
								value={searchQuery}
								onChange={(event) =>
									setSearchQuery(event.target.value)
								}
								placeholder="Search..."
								className="pl-8 h-8 w-40 bg-muted/30 border-border/50 rounded-lg text-sm"
							/>
						</div>
						<div className="flex items-center border border-border/50 rounded-lg overflow-hidden">
							<button
								type="button"
								onClick={() => setViewMode("grid")}
								className={cn(
									"p-1.5 transition-colors",
									viewMode === "grid"
										? "bg-muted text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<Grid3X3 className="size-3.5" />
							</button>
							<button
								type="button"
								onClick={() => setViewMode("list")}
								className={cn(
									"p-1.5 transition-colors",
									viewMode === "list"
										? "bg-muted text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<LayoutList className="size-3.5" />
							</button>
						</div>
					</div>
				</div>

				{/* Content */}
				{isLoading ? (
					<div className="text-muted-foreground text-sm py-20 text-center">
						Loading gallery...
					</div>
				) : filteredProjects.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<div className="size-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
							<ImageIcon className="size-7 text-muted-foreground/50" />
						</div>
						<h3 className="text-lg font-medium mb-1">
							{searchQuery
								? "No results found"
								: "Your gallery is empty"}
						</h3>
						<p className="text-sm text-muted-foreground max-w-sm">
							{searchQuery
								? "Try a different search term"
								: "Create your first video or image to see it here"}
						</p>
					</div>
				) : viewMode === "grid" ? (
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
						{filteredProjects.map((project) => (
							<GalleryGridCard
								key={project.id}
								project={project}
							/>
						))}
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{filteredProjects.map((project) => (
							<GalleryListCard
								key={project.id}
								project={project}
							/>
						))}
					</div>
				)}
			</main>

			<Footer />
		</div>
	);
}

function GalleryGridCard({ project }: { project: TProjectMetadata }) {
	const isVideo = (project.type ?? "video") === "video";
	const href = isVideo
		? `/editor/${project.id}`
		: `/images/${project.id}`;

	return (
		<div className="group relative">
			<Link href={href} className="block">
				<div className="overflow-hidden rounded-xl border border-border/50 hover:border-border/80 transition-colors bg-muted/10">
					<div className="relative aspect-video bg-muted/30 flex items-center justify-center">
						{project.thumbnail ? (
							<Image
								src={project.thumbnail}
								alt={project.name}
								fill
								className="object-cover group-hover:scale-105 transition-transform duration-500"
							/>
						) : isVideo ? (
							<Film className="size-8 text-muted-foreground/30" />
						) : (
							<ImageIcon className="size-8 text-muted-foreground/30" />
						)}
						<div className="absolute top-2 left-2">
							<span
								className={cn(
									"px-1.5 py-0.5 rounded text-[10px] font-medium",
									isVideo
										? "bg-blue-500/20 text-blue-400"
										: "bg-amber-500/20 text-amber-400",
								)}
							>
								{isVideo ? "Video" : "Image"}
							</span>
						</div>
					</div>
					<div className="p-2.5">
						<p className="text-xs font-medium truncate">
							{project.name}
						</p>
						<p className="text-[10px] text-muted-foreground mt-0.5">
							{formatDate(project.updatedAt)}
						</p>
					</div>
				</div>
			</Link>
			<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
				<ShareMenu
					title={project.name}
					url={`${typeof window !== "undefined" ? window.location.origin : ""}${href}`}
					triggerClassName="size-7 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm"
				/>
			</div>
		</div>
	);
}

function GalleryListCard({ project }: { project: TProjectMetadata }) {
	const isVideo = (project.type ?? "video") === "video";
	const href = isVideo
		? `/editor/${project.id}`
		: `/images/${project.id}`;

	return (
		<Link
			href={href}
			className="flex items-center gap-4 p-3 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors"
		>
			<div className="size-12 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
				{project.thumbnail ? (
					<Image
						src={project.thumbnail}
						alt={project.name}
						fill
						className="object-cover"
					/>
				) : isVideo ? (
					<Film className="size-5 text-muted-foreground/40" />
				) : (
					<ImageIcon className="size-5 text-muted-foreground/40" />
				)}
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium truncate">{project.name}</p>
				<div className="flex items-center gap-2 mt-0.5">
					<span
						className={cn(
							"text-[10px] font-medium",
							isVideo ? "text-blue-400" : "text-amber-400",
						)}
					>
						{isVideo ? "Video" : "Image"}
					</span>
					<span className="text-[10px] text-muted-foreground">
						{formatDate(project.updatedAt)}
					</span>
					{project.duration > 0 && (
						<span className="text-[10px] text-muted-foreground">
							{formatDuration(project.duration)}
						</span>
					)}
				</div>
			</div>
			<ExternalLink className="size-4 text-muted-foreground/40" />
		</Link>
	);
}

function formatDate(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays} days ago`;

	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
	});
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;
}
