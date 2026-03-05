import uuid
from typing import AsyncGenerator

import google.generativeai as genai

from .types import AIMessage, AIProviderName, StreamChunk, ToolCall, ToolDefinition


class GeminiProvider:
    name: AIProviderName = "gemini"

    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self._api_key = api_key

    async def chat(
        self,
        messages: list[AIMessage],
        tools: list[ToolDefinition],
        system_prompt: str,
    ) -> AsyncGenerator[StreamChunk, None]:
        gemini_tools = _to_gemini_tools(tools) if tools else None
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system_prompt,
            tools=gemini_tools,
        )

        contents = _to_gemini_contents(messages)
        response = await model.generate_content_async(contents, stream=True)

        async for chunk in response:
            for part in chunk.parts:
                if hasattr(part, "text") and part.text:
                    yield StreamChunk(type="text", text=part.text)

                if hasattr(part, "function_call") and part.function_call:
                    call_id = f"gemini-{uuid.uuid4()}"
                    fc = part.function_call
                    yield StreamChunk(
                        type="tool_call_start",
                        toolCall=ToolCall(id=call_id, name=fc.name),
                    )
                    yield StreamChunk(
                        type="tool_call_end",
                        toolCall=ToolCall(
                            id=call_id,
                            name=fc.name,
                            arguments=dict(fc.args) if fc.args else {},
                        ),
                    )

        yield StreamChunk(type="done")


def _to_gemini_contents(messages: list[AIMessage]) -> list[dict]:
    contents = []
    for msg in messages:
        if msg.role == "system":
            continue

        role = "model" if msg.role == "assistant" else "user"

        if msg.role == "user" and msg.toolResults:
            parts = []
            for tr in msg.toolResults:
                # Find the matching tool call name from previous messages
                func_name = tr.toolCallId
                for prev_msg in messages:
                    if prev_msg.role == "assistant" and prev_msg.toolCalls:
                        for tc in prev_msg.toolCalls:
                            if tc.id == tr.toolCallId:
                                func_name = tc.name
                                break
                parts.append(
                    {
                        "function_response": {
                            "name": func_name,
                            "response": {"result": tr.content},
                        }
                    }
                )
            contents.append({"role": "user", "parts": parts})
            continue

        if msg.role == "assistant" and msg.toolCalls:
            parts = []
            if msg.content:
                parts.append({"text": msg.content})
            for tc in msg.toolCalls:
                parts.append({
                    "function_call": {
                        "name": tc.name,
                        "args": tc.arguments or {},
                    }
                })
            contents.append({"role": "model", "parts": parts})
            continue

        contents.append({"role": role, "parts": [{"text": msg.content}]})
    return contents


def _to_gemini_tools(tools: list[ToolDefinition]) -> list[dict]:
    if not tools:
        return []
    return [
        {
            "function_declarations": [
                {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                }
                for t in tools
            ]
        }
    ]
