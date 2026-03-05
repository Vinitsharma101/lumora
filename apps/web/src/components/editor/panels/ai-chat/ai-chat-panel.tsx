"use client";

import { useAIChatStore } from "@/stores/ai-chat-store";
import { AIChatHeader } from "./ai-chat-header";
import { AIChatMessages } from "./ai-chat-messages";
import { AIChatInput } from "./ai-chat-input";
import { cn } from "@/utils/ui";

export function AIChatPanel() {
	const { isPanelOpen } = useAIChatStore();

	return (
		<div
			className={cn(
				"fixed top-0 right-0 z-50 flex h-full w-[420px] flex-col border-l bg-background shadow-xl transition-transform duration-300 ease-in-out",
				isPanelOpen ? "translate-x-0" : "translate-x-full",
			)}
		>
			<AIChatHeader />
			<AIChatMessages />
			<AIChatInput />
		</div>
	);
}
