"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAIChatStore, type AIProvider } from "@/stores/ai-chat-store";
import { X, Plus } from "lucide-react";

const PROVIDERS: { value: AIProvider; label: string }[] = [
	{ value: "claude", label: "Claude" },
	{ value: "openai", label: "GPT-4o" },
	{ value: "gemini", label: "Gemini" },
];

export function AIChatHeader() {
	const { selectedProvider, setProvider, closePanel, clearMessages } =
		useAIChatStore();

	return (
		<div className="flex items-center justify-between px-3 py-2.5">
			<div className="flex items-center gap-2">
				<span className="text-sm font-medium">AI Chat</span>
				<Select
					value={selectedProvider}
					onValueChange={(v) => setProvider(v as AIProvider)}
				>
					<SelectTrigger size="sm" className="h-7 w-[110px] text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{PROVIDERS.map((p) => (
							<SelectItem key={p.value} value={p.value}>
								{p.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex items-center gap-0.5">
				<Button
					variant="ghost"
					size="icon"
					className="size-7"
					onClick={clearMessages}
					title="New chat"
				>
					<Plus className="size-3.5" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="size-7"
					onClick={closePanel}
					title="Close panel"
				>
					<X className="size-3.5" />
				</Button>
			</div>
		</div>
	);
}
