"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/hooks/use-editor";
import { useMovieStore } from "@/stores/movie-store";
import { cn } from "@/utils/ui";
import { Film, ImageIcon, Wand2 } from "lucide-react";

interface HomeChatProps {
	className?: string;
	externalPrompt?: string;
}

type ContentType = "video" | "image";
type CreationMode = "edit" | "generate";

export function HomeChat({ className, externalPrompt }: HomeChatProps) {
	const [prompt, setPrompt] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [mode, setMode] = useState<CreationMode>("generate");
	const [contentType, setContentType] = useState<ContentType>("video");
	const editor = useEditor();
	const router = useRouter();
	const previousExternalPrompt = useRef(externalPrompt);

	useEffect(() => {
		if (
			externalPrompt &&
			externalPrompt !== previousExternalPrompt.current
		) {
			setPrompt(externalPrompt);
		}
		previousExternalPrompt.current = externalPrompt;
	}, [externalPrompt]);

	const hasInput = prompt.trim().length > 0;

	const handleSubmit = async (event?: React.FormEvent) => {
		if (event) event.preventDefault();
		if (!hasInput || isSubmitting) return;

		setIsSubmitting(true);
		try {
			const projectId = await editor.project.createNewProject({
				name: prompt.trim().slice(0, 60),
				type: contentType,
			});

			if (contentType === "image") {
				router.push(`/images/${projectId}`);
			} else if (mode === "generate") {
				useMovieStore.getState().setQuery(prompt.trim());
				useMovieStore.getState().setProjectId(projectId);
				router.push(`/movie/${projectId}`);
			} else {
				router.push(`/editor/${projectId}`);
			}
		} catch (error) {
			toast.error("Failed to create project", {
				description:
					error instanceof Error ? error.message : "Please try again",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	};

	return (
		<div
			className={cn(
				"w-full max-w-3xl mx-auto flex flex-col items-center justify-center gap-3",
				className,
			)}
		>
			{/* Image / Video Toggle */}
			<div className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 p-1">
				<button
					type="button"
					onClick={() => setContentType("video")}
					className={cn(
						"flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
						contentType === "video"
							? "bg-foreground text-background shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					<Film className="size-3.5" />
					Video
				</button>
				<button
					type="button"
					onClick={() => setContentType("image")}
					className={cn(
						"flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
						contentType === "image"
							? "bg-foreground text-background shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					<ImageIcon className="size-3.5" />
					Image
				</button>
			</div>

			{/* Chat Input */}
			<form
				onSubmit={handleSubmit}
				className="w-full relative bg-muted/30 rounded-2xl border border-border/50 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-border/80 flex flex-col"
			>
				<textarea
					value={prompt}
					onChange={(event) => setPrompt(event.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={
						contentType === "image"
							? "Describe the image you want to create..."
							: mode === "generate"
								? "Describe your video and AI will create it..."
								: "Describe what you want to create..."
					}
					className="w-full min-h-[80px] bg-transparent border-none resize-none focus:outline-none focus:ring-0 px-5 pt-4 pb-14 text-base placeholder:text-muted-foreground/60 leading-relaxed"
					disabled={isSubmitting}
				/>
				{/* Mode toggle (only for video) */}
				{contentType === "video" && (
					<div className="absolute left-4 bottom-3 flex items-center gap-1">
						<button
							type="button"
							onClick={() => setMode("generate")}
							className={cn(
								"flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
								mode === "generate"
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
							)}
						>
							<Wand2 className="size-3" />
							AI Generate
						</button>
						<button
							type="button"
							onClick={() => setMode("edit")}
							className={cn(
								"flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
								mode === "edit"
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
							)}
						>
							<Film className="size-3" />
							Open Editor
						</button>
					</div>
				)}
				<div className="absolute right-4 bottom-3 flex items-center justify-center cursor-pointer">
					<Button
						type="submit"
						size="icon"
						disabled={!hasInput || isSubmitting}
						className={cn(
							"size-10 rounded-full transition-all duration-300 transform",
							hasInput
								? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 shadow-md"
								: "bg-muted-foreground/20 text-muted-foreground",
						)}
					>
						<HugeiconsIcon icon={ArrowUp02Icon} className="size-5" />
					</Button>
				</div>
			</form>
		</div>
	);
}
