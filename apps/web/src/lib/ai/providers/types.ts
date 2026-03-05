export type AIProviderName = "claude" | "openai" | "gemini";

export interface AIMessage {
	role: "user" | "assistant" | "system";
	content: string;
	toolCalls?: ToolCall[];
	toolResults?: ToolResult[];
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export interface ToolResult {
	toolCallId: string;
	content: string;
	isError?: boolean;
}

export type StreamChunkType = "text" | "tool_call_start" | "tool_call_delta" | "tool_call_end" | "error" | "done";

export interface StreamChunk {
	type: StreamChunkType;
	text?: string;
	toolCall?: Partial<ToolCall>;
	error?: string;
}

export interface ChatParams {
	messages: AIMessage[];
	tools: ToolDefinition[];
	systemPrompt: string;
}

export interface AIProvider {
	name: AIProviderName;
	chat(params: ChatParams): AsyncGenerator<StreamChunk>;
}
