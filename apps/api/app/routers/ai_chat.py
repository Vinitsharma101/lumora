import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sse_starlette.sse import EventSourceResponse

from app.ai.providers import get_api_key_for_provider, get_provider
from app.config import settings
from app.rate_limit import check_rate_limit
from app.schemas.ai import ChatRequest

logger = logging.getLogger(__name__)
router = APIRouter(tags=["ai"])


@router.post("/api/ai/chat")
async def ai_chat(request: Request):
    body_raw = await request.json()
    try:
        body = ChatRequest(**body_raw)
    except ValidationError as exc:
        logger.error("Validation error: %s", exc)
        logger.error("Request body keys: %s", list(body_raw.keys()) if isinstance(body_raw, dict) else type(body_raw))
        # Return detailed validation errors so frontend can diagnose
        errors = []
        for e in exc.errors():
            errors.append({
                "field": ".".join(str(loc) for loc in e["loc"]),
                "message": e["msg"],
                "type": e["type"],
            })
        return JSONResponse(
            {"error": "Validation error", "details": errors},
            status_code=400,
        )
    await check_rate_limit(request)

    api_key = get_api_key_for_provider(
        body.provider,
        anthropic_key=settings.ANTHROPIC_API_KEY,
        openai_key=settings.OPENAI_API_KEY,
        google_key=settings.GOOGLE_AI_API_KEY,
    )
    if not api_key:
        key_var_map = {"claude": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY", "gemini": "GOOGLE_AI_API_KEY"}
        env_var = key_var_map.get(body.provider, "unknown")
        return JSONResponse(
            {"error": f"No API key configured for provider '{body.provider}'. Set the {env_var} environment variable in your .env file."},
            status_code=400,
        )

    provider = get_provider(body.provider, api_key)

    async def event_generator():
        try:
            async for chunk in provider.chat(
                messages=body.messages,
                tools=body.tools or [],
                system_prompt=body.systemPrompt or "",
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
