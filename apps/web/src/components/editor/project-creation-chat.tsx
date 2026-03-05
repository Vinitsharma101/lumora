import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";

export function ProjectCreationChat({ className }: { className?: string }) {
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
			});
			router.push(`/editor/${projectId}`);
		} catch (error) {
			toast.error("Failed to create project", {
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
				"w-full max-w-[740px] mx-auto flex flex-col items-center justify-center",
				className,
			)}
		>
			<form
				onSubmit={handleCreateProject}
				className="w-full relative bg-muted/40 aspect-[6/1] sm:aspect-[8/1] rounded-[18px] border border-border/50 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-border/80 flex items-center p-2"
			>
				<textarea
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="What do you want to create?"
					className="w-full h-full bg-transparent border-none resize-none focus:outline-none focus:ring-0 px-4 py-3 sm:py-4 text-base sm:text-lg placeholder:text-muted-foreground/70"
					disabled={isSubmitting}
				/>
				<div className="absolute right-3 bottom-3 sm:right-4 sm:bottom-4 flex items-center justify-center">
					<Button
						type="submit"
						size="icon"
						disabled={!hasInput || isSubmitting}
						className={cn(
							"size-10 rounded-full transition-all duration-200",
							hasInput
								? "bg-primary text-primary-foreground hover:bg-primary/90"
								: "bg-muted text-muted-foreground",
						)}
					>
						<HugeiconsIcon icon={ArrowUp02Icon} className="size-5" />
					</Button>
				</div>
			</form>
		</div>
	);
}
