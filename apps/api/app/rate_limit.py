"""Sliding window rate limiter using direct Redis connection."""

import time

from fastapi import HTTPException, Request
from redis.asyncio import Redis

from app.config import settings

_redis: Redis | None = None

RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 100


async def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def check_rate_limit(request: Request) -> None:
    """Sliding window rate limiter. Raises 429 if exceeded."""
    redis = await get_redis()
    ip = request.headers.get("x-forwarded-for", "anonymous").split(",")[0].strip()
    key = f"rate-limit:{ip}"
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW

    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, "-inf", window_start)
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, RATE_LIMIT_WINDOW + 1)
    results = await pipe.execute()

    request_count = results[2]
    if request_count > RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again in a moment.",
        )
