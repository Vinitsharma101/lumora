import json
from typing import AsyncGenerator

import anthropic

from .types import AIMessage, AIProviderName, StreamChunk, ToolCall, ToolDefinition


class ClaudeProvider:
    name: AIProviderName = "claude"

    def __init__(self, api_key: str):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)

    async def chat(
        self,
        messages: list[AIMessage],
        tools: list[ToolDefinition],
        system_prompt: str,
    ) -> AsyncGenerator[StreamChunk, None]:
        anthropic_messages = _to_anthropic_messages(messages)
        anthropic_tools = _to_anthropic_tools(tools) if tools else None

        async with self.client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=anthropic_messages,
            tools=anthropic_tools,
        ) as stream:
            tool_input_buffers: dict[int, dict] = {}

            async for event in stream:
                if event.type == "content_block_start":
                    if event.content_block.type == "tool_use":
                        tool_input_buffers[event.index] = {
                            "id": event.content_block.id,
                            "name": event.content_block.name,
                            "json": "",
                        }
                        yield StreamChunk(
                            type="tool_call_start",
                            toolCall=ToolCall(
                                id=event.content_block.id,
                                name=event.content_block.name,
                            ),
                        )

                elif event.type == "content_block_delta":
                    if event.delta.type == "text_delta":
                        yield StreamChunk(type="text", text=event.delta.text)
                    elif event.delta.type == "input_json_delta":
                        buf = tool_input_buffers.get(event.index)
                        if buf:
                            buf["json"] += event.delta.partial_json

                elif event.type == "content_block_stop":
                    buf = tool_input_buffers.pop(event.index, None)
                    if buf:
                        try:
                            args = json.loads(buf["json"] or "{}")
                        except json.JSONDecodeError:
                            args = {}
                        yield StreamChunk(
                            type="tool_call_end",
                            toolCall=ToolCall(
                                id=buf["id"],
                                name=buf["name"],
                                arguments=args,
                            ),
                        )

                elif event.type == "message_stop":
                    yield StreamChunk(type="done")


def _to_anthropic_messages(messages: list[AIMessage]) -> list[dict]:
    result = []
    for msg in messages:
        if msg.role == "system":
            continue

        if msg.role == "user" and msg.toolResults:
            content = [
                {
                    "type": "tool_result",
                    "tool_use_id": tr.toolCallId,
                    "content": tr.content,
                    "is_error": tr.isError or False,
                }
                for tr in msg.toolResults
            ]
            result.append({"role": "user", "content": content})
            continue

        if msg.role == "assistant" and msg.toolCalls:
            content = []
            if msg.content:
                content.append({"type": "text", "text": msg.content})
            for tc in msg.toolCalls:
                content.append({
                    "type": "tool_use",
                    "id": tc.id,
                    "name": tc.name,
                    "input": tc.arguments or {},
                })
            result.append({"role": "assistant", "content": content})
            continue

        result.append({"role": msg.role, "content": msg.content})
    return result


def _to_anthropic_tools(tools: list[ToolDefinition]) -> list[dict]:
    return [
        {
            "name": t.name,
            "description": t.description,
            "input_schema": t.parameters,
        }
        for t in tools
    ]
