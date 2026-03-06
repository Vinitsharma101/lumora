"""Shared httpx.AsyncClient pool for all outbound HTTP calls.

Reusing a single client avoids TCP/TLS handshake overhead per request.
The client is created lazily and closed on application shutdown via the lifespan hook.
"""

import httpx

_client: httpx.AsyncClient | None = None


async def get_http_client() -> httpx.AsyncClient:
    """Get the shared httpx.AsyncClient singleton."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
            follow_redirects=True,
        )
    return _client


async def close_http_client() -> None:
    """Close the shared client. Call from lifespan shutdown."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
