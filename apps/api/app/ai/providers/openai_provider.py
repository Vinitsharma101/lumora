import json
from typing import AsyncGenerator

from openai import AsyncOpenAI

from .types import AIMessage, AIProviderName, StreamChunk, ToolCall, ToolDefinition


class OpenAIProvider:
    name: AIProviderName = "openai"

    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)

    async def chat(
        self,
        messages: list[AIMessage],
        tools: list[ToolDefinition],
        system_prompt: str,
    ) -> AsyncGenerator[StreamChunk, None]:
        openai_messages = _to_openai_messages(messages, system_prompt)
        openai_tools = _to_openai_tools(tools) if tools else None

        stream = await self.client.chat.completions.create(
            model="gpt-4o",
            stream=True,
            messages=openai_messages,
            tools=openai_tools,
        )

        tool_call_buffers: dict[int, dict] = {}

        async for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if not delta:
                continue

            if delta.content:
                yield StreamChunk(type="text", text=delta.content)

            if delta.tool_calls:
                for tc in delta.tool_calls:
                    if tc.id:
                        tool_call_buffers[tc.index] = {
                            "id": tc.id,
                            "name": tc.function.name if tc.function else "",
                            "args": tc.function.arguments if tc.function else "",
                        }
                        yield StreamChunk(
                            type="tool_call_start",
                            toolCall=ToolCall(
                                id=tc.id,
                                name=tc.function.name if tc.function else "",
                            ),
                        )
                    else:
                        buf = tool_call_buffers.get(tc.index)
                        if buf and tc.function and tc.function.arguments:
                            buf["args"] += tc.function.arguments

            finish_reason = chunk.choices[0].finish_reason if chunk.choices else None

            if finish_reason == "tool_calls":
                for buf in tool_call_buffers.values():
                    try:
                        args = json.loads(buf["args"] or "{}")
                    except json.JSONDecodeError:
                        args = {}
                    yield StreamChunk(
                        type="tool_call_end",
                        toolCall=ToolCall(id=buf["id"], name=buf["name"], arguments=args),
                    )
                tool_call_buffers.clear()

            if finish_reason == "stop":
                yield StreamChunk(type="done")


def _to_openai_messages(messages: list[AIMessage], system_prompt: str) -> list[dict]:
    result: list[dict] = [{"role": "system", "content": system_prompt}]

    for msg in messages:
        if msg.role == "system":
            continue

        if msg.role == "user" and msg.toolResults:
            for tr in msg.toolResults:
                result.append({
                    "role": "tool",
                    "tool_call_id": tr.toolCallId,
                    "content": tr.content,
                })
            if msg.content:
                result.append({"role": "user", "content": msg.content})
            continue

        if msg.role == "assistant" and msg.toolCalls:
            result.append({
                "role": "assistant",
                "content": msg.content or None,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.arguments or {}),
                        },
                    }
                    for tc in msg.toolCalls
                ],
            })
            continue

        result.append({"role": msg.role, "content": msg.content})
    return result


def _to_openai_tools(tools: list[ToolDefinition]) -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            },
        }
        for t in tools
    ]
