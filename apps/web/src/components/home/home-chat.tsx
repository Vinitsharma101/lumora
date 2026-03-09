"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon, Attachment01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";

interface HomeChatProps {
	className?: string;
	mode: "image" | "video";
}

export function HomeChat({ className, mode }: HomeChatProps) {
	const [prompt, setPrompt] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const editor = useEditor();
	const router = useRouter();

	const hasInput = prompt.trim().length > 0;

	const handleCreateProject = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!hasInput || isSubmitting) return;

		setIsSubmitting(true);
		try {
			const projectId = await editor.project.createNewProject({
				name: prompt.trim(),
				type: mode,
			});
			if (mode === "image") {
				router.push(`/images/${projectId}`);
			} else {
				router.push(`/editor/${projectId}`);
			}
		} catch (error) {
			toast.error(`Failed to create ${mode} project`, {
				description:
					error instanceof Error ? error.message : "Please try again",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleCreateProject();
		}
	};

	return (
		<div
			className={cn(
				"w-full max-w-3xl mx-auto flex flex-col items-center justify-center gap-4",
				className,
			)}
		>
			<form
				onSubmit={handleCreateProject}
				className="w-full relative bg-muted/30 rounded-2xl border border-border/50 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-border/80 flex flex-col"
			>
				<textarea
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={`Describe the ${mode} you want to create...`}
					className="w-full min-h-[140px] bg-transparent border-none resize-none focus:outline-none focus:ring-0 px-5 pt-5 pb-16 text-lg sm:text-xl placeholder:text-muted-foreground/60 leading-relaxed font-medium"
					disabled={isSubmitting}
				/>
				<div className="absolute left-4 bottom-4 flex items-center justify-center">
					<Button
						type="button"
						size="icon"
						variant="ghost"
						className="size-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
						title="Upload an asset"
					>
						<HugeiconsIcon icon={Attachment01Icon} className="size-5" />
					</Button>
				</div>
				<div className="absolute right-4 bottom-4 flex items-center justify-center cursor-pointer">
					<Button
						type="submit"
						size="icon"
						disabled={!hasInput || isSubmitting}
						className={cn(
							"size-12 rounded-full transition-all duration-300 transform",
							hasInput
								? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 shadow-md"
								: "bg-muted-foreground/20 text-muted-foreground",
						)}
					>
						<HugeiconsIcon icon={ArrowUp02Icon} className="size-6" />
					</Button>
				</div>
			</form>
		</div>
	);
}
