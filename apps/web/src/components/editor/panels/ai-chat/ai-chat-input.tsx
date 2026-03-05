"use client";

import { useEffect, useRef, useState } from "react";
import { useAIChatStore } from "@/stores/ai-chat-store";
import type { AIPendingContext } from "@/stores/ai-chat-store";
import { useAIChat } from "@/hooks/use-ai-chat";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square, X } from "lucide-react";
import { cn } from "@/utils/ui";

function formatMediaType(type: string): string {
	const labels: Record<string, string> = {
		video: "Video",
		audio: "Audio",
		image: "Image",
		text: "Text",
		sticker: "Sticker",
	};
	return labels[type] ?? type;
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = (seconds % 60).toFixed(1);
	return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function buildContextPrefix(context: AIPendingContext): string {
	const parts: string[] = [];

	for (const element of context.elements) {
		const mediaLabel = formatMediaType(element.type);
		parts.push(
			`[${mediaLabel}: "${element.name}" at ${formatDuration(element.startTime)}, duration ${formatDuration(element.duration)}]`,
		);
	}

	if (context.selectionRange) {
		parts.push(
			`[Selection: ${formatDuration(context.selectionRange.start)} – ${formatDuration(context.selectionRange.end)}]`,
		);
	}

	return parts.join(" ");
}

function PendingContextBadges({
	context,
	onClear,
}: {
	context: AIPendingContext;
	onClear: () => void;
}) {
	const typeColors: Record<string, string> = {
		video: "bg-blue-500/20 text-blue-400 border-blue-500/30",
		audio: "bg-green-500/20 text-green-400 border-green-500/30",
		image: "bg-amber-500/20 text-amber-400 border-amber-500/30",
		text: "bg-purple-500/20 text-purple-400 border-purple-500/30",
		sticker: "bg-pink-500/20 text-pink-400 border-pink-500/30",
	};

	return (
		<div className="flex flex-wrap items-center gap-1.5 px-3 pb-1 pt-2">
			<span className="text-xs text-muted-foreground">Context:</span>
			{context.elements.map((element) => (
				<span
					key={element.id}
					className={cn(
						"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
						typeColors[element.type] ?? "bg-muted text-muted-foreground",
					)}
				>
					{formatMediaType(element.type)}: {element.name}
				</span>
			))}
			<button
				type="button"
				onClick={onClear}
				className="ml-auto rounded-full p-0.5 text-muted-foreground hover:text-foreground"
			>
				<X className="size-3" />
			</button>
		</div>
	);
}

export function AIChatInput() {
	const [input, setInput] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { isStreaming, pendingContext } = useAIChatStore();
	const { sendMessage, stopStreaming } = useAIChat();

	// Auto-focus input when pending context arrives
	useEffect(() => {
		if (pendingContext && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [pendingContext]);

	const handleClearContext = () => {
		useAIChatStore.getState().clearPendingContext();
	};

	const handleSubmit = () => {
		const trimmed = input.trim();
		if (!trimmed || isStreaming) return;

		// Build context-enriched message
		let messageContent = trimmed;
		if (pendingContext && pendingContext.elements.length > 0) {
			const contextPrefix = buildContextPrefix(pendingContext);
			messageContent = `${contextPrefix}\n\n${trimmed}`;
		}

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

		// Clear context after sending
		useAIChatStore.getState().clearPendingContext();

		sendMessage(messageContent);
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	};

	const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(event.target.value);
		const textarea = event.target;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
	};

	const placeholderText = pendingContext
		? `Ask about the selected ${pendingContext.elements.map((element) => formatMediaType(element.type).toLowerCase()).join(", ")}...`
		: "Describe your edit...";

	return (
		<div className="border-t p-3">
			{pendingContext && pendingContext.elements.length > 0 && (
				<PendingContextBadges
					context={pendingContext}
					onClear={handleClearContext}
				/>
			)}
			<div
				className={cn(
					"flex items-end gap-2 rounded-lg border bg-background px-3 py-2",
					"focus-within:ring-1 focus-within:ring-ring",
					pendingContext && "ring-1 ring-purple-500/30",
				)}
			>
				<textarea
					ref={textareaRef}
					value={input}
					onChange={handleInput}
					onKeyDown={handleKeyDown}
					placeholder={placeholderText}
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
