"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { 
	ArrowUp02Icon, 
	ArrowLeft02Icon,
	Download04Icon,
	Idea01Icon,
	Image01Icon,
	Settings02Icon
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { EditorProvider } from "@/components/providers/editor-provider";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

export default function ImageEditorPage() {
	const params = useParams();
	const projectId = params.project_id as string;

	return (
		<EditorProvider projectId={projectId}>
			<div className="bg-[hsl(0,0%,3%)] text-[hsl(0,0%,96%)] flex h-screen w-screen flex-col overflow-hidden font-sans">
				<ImageEditorHeader />
				<div className="flex-1 min-h-0 flex w-full">
					<ImageEditorLayout />
				</div>
			</div>
		</EditorProvider>
	);
}

function ImageEditorHeader() {
	const editor = useEditor();
	const router = useRouter();
	const [projectName, setProjectName] = useState("Untitled Image");

	// Update project name state on load/change
	useEffect(() => {
		const updateName = () => {
			const project = editor.project.getActiveOrNull();
			if (project) {
				setProjectName(project.metadata.name);
			}
		};
		updateName();
		const unsub = editor.project.subscribe(updateName);
		return unsub;
	}, [editor]);

	return (
		<header className="h-16 border-b border-border/20 bg-background/50 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 z-10 shrink-0">
			<div className="flex items-center gap-4">
				<Link href="/home">
					<Button variant="ghost" size="icon" className="rounded-full hover:bg-muted/30">
						<HugeiconsIcon icon={ArrowLeft02Icon} className="size-5" />
					</Button>
				</Link>
				<div className="h-4 w-px bg-border/40 mx-1" />
				<h1 className="font-medium text-sm sm:text-base truncate max-w-[200px] sm:max-w-xs text-foreground/90">
					{projectName}
				</h1>
			</div>

			<div className="flex items-center gap-2">
				<Button variant="outline" size="sm" className="hidden sm:flex gap-2 rounded-full border-border/30 bg-background/50">
					<HugeiconsIcon icon={Settings02Icon} className="size-4" />
					Settings
				</Button>
				<Button size="sm" className="gap-2 rounded-full font-medium">
					<HugeiconsIcon icon={Download04Icon} className="size-4" />
					Export
				</Button>
			</div>
		</header>
	);
}

function ImageEditorLayout() {
	const [prompt, setPrompt] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [generatedImages, setGeneratedImages] = useState<{ id: string; url: string; prompt: string }[]>([]);

	// Dummy function to simulate generation
	const handleGenerate = () => {
		if (!prompt.trim() || isGenerating) return;
		setIsGenerating(true);
		
		// Simulate network request
		setTimeout(() => {
			const newImage = {
				id: Math.random().toString(36).substring(7),
				url: `https://picsum.photos/seed/${Math.random()}/1024/1024`,
				prompt: prompt,
			};
			setGeneratedImages((prev) => [newImage, ...prev]);
			setIsGenerating(false);
			toast.success("Image generated successfully!");
		}, 2500);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleGenerate();
		}
	};

	return (
		<div className="flex flex-col md:flex-row w-full h-full relative">
			
			{/* Main Gallery Area */}
			<div className="flex-1 bg-[hsl(0,0%,5%)] relative overflow-y-auto p-4 sm:p-8 custom-scrollbar">
				{generatedImages.length === 0 ? (
					<div className="size-full flex flex-col items-center justify-center opacity-60">
						<div className="w-24 h-24 mb-6 rounded-3xl bg-muted/10 flex items-center justify-center border border-border/5 shadow-inner">
							<HugeiconsIcon icon={Image01Icon} className="size-10 text-muted-foreground" />
						</div>
						<h2 className="text-xl font-medium tracking-tight mb-2">No images generated yet</h2>
						<p className="text-sm text-muted-foreground text-center max-w-sm">
							Enter a prompt in the panel to create your first image. Try describing the subject, setting, and style.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-40 md:pb-8">
						{generatedImages.map((img, idx) => (
							<div key={img.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-muted/20 border border-border/10 shadow-lg transition-all hover:shadow-xl hover:border-border/30">
								{/* Image placeholder - in a real app this would be next/image or a normal img */}
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img 
									src={img.url} 
									alt={img.prompt} 
									className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
									loading={idx > 3 ? "lazy" : "eager"}
								/>
								<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5">
									<p className="text-white/90 text-sm line-clamp-3 font-medium leading-relaxed drop-shadow-md">
										{img.prompt}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Generation Panel */}
			<div className="w-full md:w-[400px] lg:w-[440px] bg-background/95 backdrop-blur-xl border-t md:border-t-0 md:border-l border-border/20 flex flex-col shrink-0 shadow-2xl z-20 absolute md:relative bottom-0 max-h-[60vh] md:max-h-none rounded-t-3xl md:rounded-none">
				<div className="p-5 md:p-6 flex-1 flex flex-col">
					<h3 className="text-lg font-semibold tracking-tight mb-4 hidden md:block flex-shrink-0">Create Image</h3>
					
					{/* Prompt Textarea */}
					<div className="relative rounded-2xl bg-muted/30 border border-border/40 focus-within:border-primary/50 focus-within:bg-muted/40 transition-all shadow-inner overflow-hidden flex-shrink-0">
						<textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Describe the image you want to see..."
							className="w-full h-[120px] md:h-[180px] bg-transparent border-none resize-none focus:outline-none focus:ring-0 p-4 md:p-5 text-base placeholder:text-muted-foreground/60 leading-relaxed font-medium"
							disabled={isGenerating}
						/>
						
						<div className="absolute left-3 bottom-3 flex gap-1">
							<Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground hover:text-foreground">
								<HugeiconsIcon icon={Idea01Icon} className="size-4" />
							</Button>
						</div>

						<div className="absolute right-3 bottom-3">
							<Button 
								size="icon" 
								onClick={handleGenerate}
								disabled={!prompt.trim() || isGenerating}
								className={cn(
									"size-10 rounded-full transition-all duration-300 transform",
									prompt.trim() && !isGenerating
										? "bg-primary text-primary-foreground hover:scale-105 shadow-md hover:shadow-primary/25"
										: "bg-muted-foreground/20 text-muted-foreground"
								)}
							>
								<HugeiconsIcon icon={ArrowUp02Icon} className="size-5" />
							</Button>
						</div>
					</div>

					{/* Settings or Suggestions */}
					<div className="mt-6 flex-1 hidden md:block overflow-y-auto pr-2 custom-scrollbar">
						<div className="space-y-6">
							<div>
								<h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider text-[11px]">Aspect Ratio</h4>
								<div className="flex gap-2">
									{["1:1", "16:9", "9:16"].map((ratio) => (
										<Button key={ratio} variant="outline" size="sm" className="flex-1 rounded-xl border-border/40 bg-background/50 hover:bg-muted/50">
											{ratio}
										</Button>
									))}
								</div>
							</div>
							
							<div>
								<h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider text-[11px]">Style Reference</h4>
								<div className="h-24 rounded-xl border border-dashed border-border/40 bg-muted/10 flex items-center justify-center text-sm text-muted-foreground hover:bg-muted/30 transition-colors cursor-pointer">
									+ Add Style Image
								</div>
							</div>
						</div>
					</div>
				</div>
				
				{/* Is Generating Overlay */}
				{isGenerating && (
					<div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-30 flex items-center justify-center rounded-t-3xl md:rounded-none">
						<div className="bg-background rounded-2xl p-6 shadow-2xl border border-border/50 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
							<div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
							<p className="font-medium">Generating your vision...</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
