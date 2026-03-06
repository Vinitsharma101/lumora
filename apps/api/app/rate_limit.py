"""Sliding window rate limiter using direct Redis connection."""

import time

from fastapi import HTTPException, Request
from redis.asyncio import ConnectionPool, Redis

from app.config import settings

_pool: ConnectionPool | None = None
_redis: Redis | None = None

RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 100


async def get_redis() -> Redis:
    global _pool, _redis
    if _redis is None:
        _pool = ConnectionPool.from_url(
            settings.REDIS_URL, decode_responses=True, max_connections=20
        )
        _redis = Redis(connection_pool=_pool)
    return _redis


async def close_redis() -> None:
    """Close Redis connections. Call from lifespan shutdown."""
    global _pool, _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
    if _pool is not None:
        await _pool.aclose()
        _pool = None


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
