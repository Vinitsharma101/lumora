import uuid
from typing import AsyncGenerator

from google import genai
from google.genai import types

from .types import AIMessage, AIProviderName, StreamChunk, ToolCall, ToolDefinition


class GeminiProvider:
    name: AIProviderName = "gemini"

    def __init__(self, api_key: str):
        self._client = genai.Client(api_key=api_key)

    async def chat(
        self,
        messages: list[AIMessage],
        tools: list[ToolDefinition],
        system_prompt: str,
    ) -> AsyncGenerator[StreamChunk, None]:
        gemini_tools = _to_gemini_tools(tools) if tools else None
        contents = _to_gemini_contents(messages)

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            tools=gemini_tools,
        )

        async for chunk in self._client.aio.models.generate_content_stream(
            model="gemini-2.0-flash",
            contents=contents,
            config=config,
        ):
            if not chunk.candidates:
                continue
            for part in chunk.candidates[0].content.parts:
                if part.text:
                    yield StreamChunk(type="text", text=part.text)

                if part.function_call:
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


def _to_gemini_contents(messages: list[AIMessage]) -> list[types.Content]:
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
                    types.Part.from_function_response(
                        name=func_name,
                        response={"result": tr.content},
                    )
                )
            contents.append(types.Content(role="user", parts=parts))
            continue

        if msg.role == "assistant" and msg.toolCalls:
            parts = []
            if msg.content:
                parts.append(types.Part.from_text(text=msg.content))
            for tc in msg.toolCalls:
                parts.append(
                    types.Part.from_function_call(
                        name=tc.name,
                        args=tc.arguments or {},
                    )
                )
            contents.append(types.Content(role="model", parts=parts))
            continue

        contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg.content)])
        )
    return contents


def _to_gemini_tools(tools: list[ToolDefinition]) -> list[types.Tool]:
    if not tools:
        return []
    declarations = []
    for t in tools:
        declarations.append(
            types.FunctionDeclaration(
                name=t.name,
                description=t.description,
                parameters=t.parameters,
            )
        )
    return [types.Tool(function_declarations=declarations)]
