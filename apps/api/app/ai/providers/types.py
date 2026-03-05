from typing import AsyncGenerator, Literal, Protocol

from pydantic import BaseModel


AIProviderName = Literal["claude", "openai", "gemini"]


class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict | None = None


class ToolResult(BaseModel):
    toolCallId: str
    content: str
    isError: bool | None = None


class AIMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    toolCalls: list[ToolCall] | None = None
    toolResults: list[ToolResult] | None = None


class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: dict


StreamChunkType = Literal["text", "tool_call_start", "tool_call_delta", "tool_call_end", "error", "done"]


class StreamChunk(BaseModel):
    type: StreamChunkType
    text: str | None = None
    toolCall: ToolCall | None = None
    error: str | None = None


class AIProvider(Protocol):
    name: AIProviderName

    def chat(
        self,
        messages: list[AIMessage],
        tools: list[ToolDefinition],
        system_prompt: str,
    ) -> AsyncGenerator[StreamChunk, None]: ...
