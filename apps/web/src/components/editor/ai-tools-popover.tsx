"use client";

import { useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/utils/ui";
import {
	AiBrainIcon,
	AiImageIcon,
	Scissor01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon, ChevronDownIcon } from "lucide-react";
import { AIGenerateView } from "./panels/assets/views/ai-generate";
import { AIImageView } from "./panels/assets/views/ai-image";
import { AutoEditView } from "./panels/assets/views/auto-edit";
import type { IconSvgElement } from "@hugeicons/react";

type AIToolKey = "ai-generate" | "ai-image" | "auto-edit";

const AI_TOOLS: Array<{
	key: AIToolKey;
	label: string;
	description: string;
	icon: IconSvgElement;
}> = [
	{
		key: "ai-generate",
		label: "AI Generate",
		description: "Create videos, images & effects with AI",
		icon: AiBrainIcon,
	},
	{
		key: "ai-image",
		label: "AI Image",
		description: "Generate and edit images with AI",
		icon: AiImageIcon,
	},
	{
		key: "auto-edit",
		label: "Auto-Edit",
		description: "AI-powered automatic editing tools",
		icon: Scissor01Icon,
	},
];

const AI_TOOL_VIEWS: Record<AIToolKey, React.ReactNode> = {
	"ai-generate": <AIGenerateView />,
	"ai-image": <AIImageView />,
	"auto-edit": <AutoEditView />,
};

export function AIToolsPopover() {
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [activeTool, setActiveTool] = useState<AIToolKey | null>(null);

	const handleSelect = (key: AIToolKey) => {
		setActiveTool(key);
		setPopoverOpen(false);
		setDialogOpen(true);
	};

	const activeToolMeta = activeTool
		? AI_TOOLS.find((t) => t.key === activeTool)
		: null;

	return (
		<>
			<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className={cn(
							"flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-3 py-1.5 text-white cursor-pointer transition-all hover:shadow-lg hover:shadow-purple-500/25",
							popoverOpen &&
								"ring-1 ring-purple-400 shadow-lg shadow-purple-500/25",
						)}
					>
						<SparklesIcon className="size-3.5" />
						<span className="text-[0.825rem] font-medium">AI Tools</span>
						<ChevronDownIcon
							className={cn(
								"size-3 transition-transform duration-200",
								popoverOpen && "rotate-180",
							)}
						/>
					</button>
				</PopoverTrigger>
				<PopoverContent align="end" sideOffset={8} className="w-64 p-1.5">
					<div className="flex flex-col gap-0.5">
						{AI_TOOLS.map((tool) => (
							<button
								key={tool.key}
								type="button"
								onClick={() => handleSelect(tool.key)}
								className="flex items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent group cursor-pointer"
							>
								<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-purple-500/15 to-indigo-500/15 group-hover:from-purple-500/25 group-hover:to-indigo-500/25 transition-colors">
									<HugeiconsIcon
										icon={tool.icon}
										className="size-4 text-purple-500"
									/>
								</div>
								<div className="flex flex-col gap-0.5">
									<span className="text-sm font-medium leading-none">
										{tool.label}
									</span>
									<span className="text-muted-foreground text-xs leading-snug">
										{tool.description}
									</span>
								</div>
							</button>
						))}
					</div>
				</PopoverContent>
			</Popover>

			{/* AI Tool Dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							{activeToolMeta && (
								<HugeiconsIcon
									icon={activeToolMeta.icon}
									className="size-5 text-purple-500"
								/>
							)}
							{activeToolMeta?.label}
						</DialogTitle>
						<DialogDescription>
							{activeToolMeta?.description}
						</DialogDescription>
					</DialogHeader>
					<div className="flex-1 overflow-y-auto -mx-6 px-0">
						{activeTool && AI_TOOL_VIEWS[activeTool]}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
