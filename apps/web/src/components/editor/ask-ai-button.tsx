"use client";

import { useAIChatStore } from "@/stores/ai-chat-store";
import { SparklesIcon } from "lucide-react";
import { cn } from "@/utils/ui";

export function AskAIButton() {
	const { togglePanel, isPanelOpen } = useAIChatStore();

	return (
		<button
			type="button"
			className={cn(
				"flex items-center gap-1.5 rounded-md bg-[#8B5CF6] px-[0.12rem] py-[0.12rem] text-white cursor-pointer",
				isPanelOpen && "ring-1 ring-purple-400",
			)}
			onClick={togglePanel}
		>
			<div className="relative flex items-center gap-1.5 rounded-[0.6rem] bg-linear-270 from-[#7C3AED] to-[#A78BFA] px-4 py-1 shadow-[0_1px_3px_0px_rgba(0,0,0,0.65)]">
				<SparklesIcon className="z-50 size-4" />
				<span className="z-50 text-[0.875rem]">Ask AI</span>
				<div className="absolute top-0 left-0 z-10 flex size-full items-center justify-center rounded-[0.6rem] bg-linear-to-t from-white/0 to-white/50">
					<div className="absolute top-[0.08rem] z-50 h-[calc(100%-2px)] w-[calc(100%-2px)] rounded-[0.6rem] bg-linear-270 from-[#7C3AED] to-[#A78BFA]" />
				</div>
			</div>
		</button>
	);
}
