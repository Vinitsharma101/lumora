"use client";

import { useRef, useState } from "react";
import { useAIChatStore } from "@/stores/ai-chat-store";
import { useAIChat } from "@/hooks/use-ai-chat";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/utils/ui";

export function AIChatInput() {
	const [input, setInput] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { isStreaming } = useAIChatStore();
	const { sendMessage, stopStreaming } = useAIChat();

	const handleSubmit = () => {
		const trimmed = input.trim();
		if (!trimmed || isStreaming) return;

		useAIChatStore.getState().addMessage({
			id: crypto.randomUUID(),
			role: "user",
			content: trimmed,
			createdAt: new Date(),
		});

		setInput("");
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}

		sendMessage(trimmed);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
		const textarea = e.target;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
	};

	return (
		<div className="border-t p-3">
			<div
				className={cn(
					"flex items-end gap-2 rounded-lg border bg-background px-3 py-2",
					"focus-within:ring-1 focus-within:ring-ring",
				)}
			>
				<textarea
					ref={textareaRef}
					value={input}
					onChange={handleInput}
					onKeyDown={handleKeyDown}
					placeholder="Describe your edit..."
					rows={1}
					className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
					style={{ fieldSizing: "content", maxHeight: "120px" }}
					disabled={isStreaming}
				/>
				{isStreaming ? (
					<Button
						size="icon"
						className="size-7 shrink-0 rounded-full"
						onClick={stopStreaming}
						variant="destructive"
					>
						<Square className="size-3" />
					</Button>
				) : (
					<Button
						size="icon"
						className="size-7 shrink-0 rounded-full"
						onClick={handleSubmit}
						disabled={!input.trim()}
					>
						<ArrowUp className="size-3.5" />
					</Button>
				)}
			</div>
		</div>
	);
}
