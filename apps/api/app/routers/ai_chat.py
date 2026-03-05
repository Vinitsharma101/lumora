import json

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.ai.providers import get_api_key_for_provider, get_provider
from app.config import settings
from app.rate_limit import check_rate_limit
from app.schemas.ai import ChatRequest

router = APIRouter(tags=["ai"])


@router.post("/api/ai/chat")
async def ai_chat(body: ChatRequest, request: Request):
    await check_rate_limit(request)

    api_key = get_api_key_for_provider(
        body.provider,
        anthropic_key=settings.ANTHROPIC_API_KEY,
        openai_key=settings.OPENAI_API_KEY,
        google_key=settings.GOOGLE_AI_API_KEY,
    )
    if not api_key:
        return {"error": f"No API key configured for {body.provider}. Set the corresponding environment variable."}

    provider = get_provider(body.provider, api_key)

    async def event_generator():
        try:
            async for chunk in provider.chat(
                messages=body.messages,
                tools=body.tools,
                system_prompt=body.systemPrompt,
            ):
                yield {"data": json.dumps(chunk.model_dump(exclude_none=True))}
        except Exception as exc:
            error_message = str(exc)
            yield {"data": json.dumps({"type": "error", "error": error_message})}

    return EventSourceResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
