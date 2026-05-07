import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AIProvider = "claude" | "openai" | "gemini";

export type ChatMessageRole = "user" | "assistant" | "system";

export interface ToolCallStatus {
	id: string;
	name: string;
	description: string;
	status: "pending" | "executing" | "success" | "error";
	arguments?: Record<string, unknown>;
	result?: string;
	error?: string;
}

export interface AttachedFile {
	id: string;
	name: string;
	type: "image" | "video" | "audio" | "file";
	mimeType: string;
	size: number;
	localUrl: string; // Object URL for preview
	uploadedUrl?: string; // Remote URL after upload
	thumbnailUrl?: string;
	status: "pending" | "uploading" | "uploaded" | "error";
	error?: string;
}

export interface ChatMessage {
	id: string;
	role: ChatMessageRole;
	content: string;
	toolCalls?: ToolCallStatus[];
	attachments?: AttachedFile[];
	createdAt: Date;
}

export interface AIPendingContext {
	elements: Array<{
		id: string;
		name: string;
		type: string;
		startTime: number;
		duration: number;
		trackId: string;
		trackType: string;
		mediaId?: string;
		content?: string;
	}>;
	selectionRange?: { start: number; end: number };
}

interface AIChatState {
	isPanelOpen: boolean;
	selectedProvider: AIProvider;
	currentSessionId: string | null;
	messages: ChatMessage[];
	isStreaming: boolean;
	error: string | null;
	pendingContext: AIPendingContext | null;
	attachedFiles: AttachedFile[];

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
	setPendingContext: (context: AIPendingContext | null) => void;
	clearPendingContext: () => void;
	addAttachedFile: (file: AttachedFile) => void;
	removeAttachedFile: (id: string) => void;
	updateAttachedFile: (id: string, update: Partial<AttachedFile>) => void;
	clearAttachedFiles: () => void;
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
			pendingContext: null,
			attachedFiles: [],

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
			setPendingContext: (context) => set({ pendingContext: context }),
			clearPendingContext: () => set({ pendingContext: null }),
			addAttachedFile: (file) =>
				set((state) => ({ attachedFiles: [...state.attachedFiles, file] })),
			removeAttachedFile: (id) =>
				set((state) => ({
					attachedFiles: state.attachedFiles.filter((f) => f.id !== id),
				})),
			updateAttachedFile: (id, update) =>
				set((state) => ({
					attachedFiles: state.attachedFiles.map((f) =>
						f.id === id ? { ...f, ...update } : f,
					),
				})),
			clearAttachedFiles: () => set({ attachedFiles: [] }),
		}),
		{
			name: "ai-chat-settings",
			partialize: (state) => ({
				selectedProvider: state.selectedProvider,
			}),
		},
	),
);
