import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AIProvider = "claude" | "openai" | "gemini";

export type ChatMessageRole = "user" | "assistant" | "system";

export interface ToolCallStatus {
	id: string;
	name: string;
	description: string;
	status: "pending" | "executing" | "success" | "error";
	result?: string;
	error?: string;
}

export interface ChatMessage {
	id: string;
	role: ChatMessageRole;
	content: string;
	toolCalls?: ToolCallStatus[];
	createdAt: Date;
}

interface AIChatState {
	isPanelOpen: boolean;
	selectedProvider: AIProvider;
	currentSessionId: string | null;
	messages: ChatMessage[];
	isStreaming: boolean;
	error: string | null;

	togglePanel: () => void;
	openPanel: () => void;
	closePanel: () => void;
	setProvider: (provider: AIProvider) => void;
	setSessionId: (id: string | null) => void;
	addMessage: (message: ChatMessage) => void;
	updateLastMessage: (update: Partial<ChatMessage>) => void;
	clearMessages: () => void;
	setStreaming: (streaming: boolean) => void;
	setError: (error: string | null) => void;
}

export const useAIChatStore = create<AIChatState>()(
	persist(
		(set) => ({
			isPanelOpen: false,
			selectedProvider: "claude",
			currentSessionId: null,
			messages: [],
			isStreaming: false,
			error: null,

			togglePanel: () =>
				set((state) => ({ isPanelOpen: !state.isPanelOpen })),
			openPanel: () => set({ isPanelOpen: true }),
			closePanel: () => set({ isPanelOpen: false }),
			setProvider: (provider) => set({ selectedProvider: provider }),
			setSessionId: (id) => set({ currentSessionId: id }),
			addMessage: (message) =>
				set((state) => ({ messages: [...state.messages, message] })),
			updateLastMessage: (update) =>
				set((state) => {
					const messages = [...state.messages];
					const lastIndex = messages.length - 1;
					if (lastIndex >= 0) {
						messages[lastIndex] = { ...messages[lastIndex], ...update };
					}
					return { messages };
				}),
			clearMessages: () =>
				set({ messages: [], currentSessionId: null, error: null }),
			setStreaming: (streaming) => set({ isStreaming: streaming }),
			setError: (error) => set({ error }),
		}),
		{
			name: "ai-chat-settings",
			partialize: (state) => ({
				selectedProvider: state.selectedProvider,
			}),
		},
	),
);
