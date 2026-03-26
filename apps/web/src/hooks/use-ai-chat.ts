import { useCallback, useRef } from "react";
import { useAIChatStore, type ToolCallStatus } from "@/stores/ai-chat-store";
import { useEditor } from "./use-editor";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { AI_TOOLS, executeToolCall } from "@/lib/ai/tools";
import { consumeSSEStream } from "@/lib/ai/stream-consumer";
import { apiFetch } from "@/lib/api-client";
import type { AIMessage, ToolCall, ToolResult } from "@/lib/ai/providers/types";

const MAX_TOOL_ROUNDS = 10;

export function useAIChat() {
	const editor = useEditor();
	const abortRef = useRef<AbortController | null>(null);
	const {
		messages,
		selectedProvider,
		isStreaming,
		addMessage,
		updateLastMessage,
		setStreaming,
		setError,
	} = useAIChatStore();

	const sendMessage = useCallback(
		async (userContent: string) => {
			if (isStreaming) return;

			setError(null);
			setStreaming(true);

			const abortController = new AbortController();
			abortRef.current = abortController;

			try {
				const systemPrompt = buildSystemPrompt(editor);

				const conversationHistory: AIMessage[] = messages.map((m) => ({
					role: m.role,
					content: m.content,
					toolCalls: m.toolCalls?.map((tc) => ({
						id: tc.id,
						name: tc.name,
						arguments: tc.result ? { result: tc.result } : {},
					})),
				}));

				conversationHistory.push({
					role: "user",
					content: userContent,
				});

				let rounds = 0;

				while (rounds < MAX_TOOL_ROUNDS) {
					rounds++;

					if (abortController.signal.aborted) break;

					const response = await apiFetch("/api/ai/chat", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							provider: selectedProvider,
							messages: conversationHistory,
							tools: AI_TOOLS,
							systemPrompt,
						}),
						signal: abortController.signal,
					});

					if (!response.ok) {
						const err = await response.json().catch(() => ({ error: "Request failed" }));
						setError(err.error || "Request failed");
						break;
					}

					let accumulatedText = "";
					const pendingToolCalls: ToolCall[] = [];
					const toolStatuses: ToolCallStatus[] = [];

					// Add placeholder assistant message
					const assistantMsgId = crypto.randomUUID();
					addMessage({
						id: assistantMsgId,
						role: "assistant",
						content: "",
						createdAt: new Date(),
					});

					for await (const chunk of consumeSSEStream(response)) {
						if (abortController.signal.aborted) break;

						switch (chunk.type) {
							case "text":
								accumulatedText += chunk.text || "";
								updateLastMessage({ content: accumulatedText });
								break;

							case "tool_call_start":
								if (chunk.toolCall?.id && chunk.toolCall?.name) {
									toolStatuses.push({
										id: chunk.toolCall.id,
										name: chunk.toolCall.name,
										description: `Calling ${chunk.toolCall.name}...`,
										status: "pending",
									});
									updateLastMessage({ toolCalls: [...toolStatuses] });
								}
								break;

							case "tool_call_end":
								if (chunk.toolCall?.id && chunk.toolCall?.name && chunk.toolCall?.arguments) {
									pendingToolCalls.push(chunk.toolCall as ToolCall);

									const idx = toolStatuses.findIndex((t) => t.id === chunk.toolCall?.id);
									if (idx >= 0) {
										toolStatuses[idx] = {
											...toolStatuses[idx],
											status: "executing",
											description: `Executing ${chunk.toolCall.name}...`,
										};
										updateLastMessage({ toolCalls: [...toolStatuses] });
									}
								}
								break;

							case "error":
								setError(chunk.error || "Stream error");
								break;

							case "done":
								break;
						}
					}

					// If no tool calls, we're done
					if (pendingToolCalls.length === 0) {
						break;
					}

					// Execute tool calls
					const toolResults: ToolResult[] = [];
					for (const tc of pendingToolCalls) {
						if (abortController.signal.aborted) break;

						const result = await executeToolCall(tc);

						const idx = toolStatuses.findIndex((t) => t.id === tc.id);
						if (idx >= 0) {
							toolStatuses[idx] = {
								...toolStatuses[idx],
								status: result.success ? "success" : "error",
								description: result.description,
								result: result.result,
								error: result.success ? undefined : result.result,
							};
							updateLastMessage({ toolCalls: [...toolStatuses] });
						}

						toolResults.push({
							toolCallId: tc.id,
							content: result.result,
							isError: !result.success,
						});
					}

					// Add to conversation history for next round
					conversationHistory.push({
						role: "assistant",
						content: accumulatedText,
						toolCalls: pendingToolCalls,
					});

					conversationHistory.push({
						role: "user",
						content: "",
						toolResults,
					});
				}
			} catch (error) {
				if ((error as Error).name !== "AbortError") {
					setError(
						error instanceof Error ? error.message : "An error occurred",
					);
				}
			} finally {
				setStreaming(false);
				abortRef.current = null;
			}
		},
		[editor, messages, selectedProvider, isStreaming, addMessage, updateLastMessage, setStreaming, setError],
	);

	const stopStreaming = useCallback(() => {
		abortRef.current?.abort();
		setStreaming(false);
	}, [setStreaming]);

	return { sendMessage, stopStreaming };
}
