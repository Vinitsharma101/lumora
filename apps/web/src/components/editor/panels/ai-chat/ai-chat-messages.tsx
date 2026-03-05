"use client";

import { useEffect, useRef } from "react";
import { useAIChatStore } from "@/stores/ai-chat-store";
import { useAIChat } from "@/hooks/use-ai-chat";
import { AIChatToolStatus } from "./ai-chat-tool-status";
import ReactMarkdown from "react-markdown";
import { cn } from "@/utils/ui";
import { Loader2, SparklesIcon, User } from "lucide-react";

export function AIChatMessages() {
	const { messages, isStreaming } = useAIChatStore();
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, isStreaming]);

	if (messages.length === 0) {
		return <EmptyState />;
	}

	return (
		<div ref={scrollRef} className="flex-1 overflow-auto scrollbar-thin p-3">
			<div className="flex flex-col gap-4">
				{messages.map((message) => (
					<div key={message.id} className="flex gap-2">
						<div
							className={cn(
								"flex size-6 shrink-0 items-center justify-center rounded-full",
								message.role === "user"
									? "bg-blue-500/10 text-blue-500"
									: "bg-purple-500/10 text-purple-500",
							)}
						>
							{message.role === "user" ? (
								<User className="size-3.5" />
							) : (
								<SparklesIcon className="size-3.5" />
							)}
						</div>
						<div className="flex-1 min-w-0">
							{message.content && (
								<div className="prose prose-sm dark:prose-invert max-w-none text-sm [&_p]:leading-relaxed [&_p]:my-1 [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded-md [&_code]:text-xs">
									<ReactMarkdown>{message.content}</ReactMarkdown>
								</div>
							)}
							{message.toolCalls && message.toolCalls.length > 0 && (
								<AIChatToolStatus tools={message.toolCalls} />
							)}
						</div>
					</div>
				))}
				{isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
					<div className="flex gap-2">
						<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500">
							<SparklesIcon className="size-3.5" />
						</div>
						<div className="flex items-center gap-1 py-1">
							<Loader2 className="size-3.5 animate-spin text-muted-foreground" />
							<span className="text-xs text-muted-foreground">Thinking...</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

const SUGGESTED_PROMPTS = [
	"Add a title card at the beginning",
	"Generate captions for the entire video",
	"Add background music that matches the mood",
	"Change to 9:16 vertical format for TikTok",
	"Add a subscribe animation overlay",
	"Generate a voiceover narration",
];

function EmptyState() {
	const { sendMessage } = useAIChat();

	const handlePromptClick = (prompt: string) => {
		useAIChatStore.getState().addMessage({
			id: crypto.randomUUID(),
			role: "user",
			content: prompt,
			createdAt: new Date(),
		});
		sendMessage(prompt);
	};

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
			<div className="flex size-12 items-center justify-center rounded-full bg-purple-500/10">
				<SparklesIcon className="size-6 text-purple-500" />
			</div>
			<div className="text-center">
				<h3 className="text-sm font-medium">AI Video Editor</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Describe what you want to edit and I&apos;ll make it happen.
				</p>
			</div>
			<div className="flex w-full flex-col gap-1.5">
				{SUGGESTED_PROMPTS.map((prompt) => (
					<button
						key={prompt}
						type="button"
						className="w-full rounded-md border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
						onClick={() => handlePromptClick(prompt)}
					>
						{prompt}
					</button>
				))}
			</div>
		</div>
	);
}
