"""
Generation Cache — Cache by prompt hash to reuse similar generations.

Significant cost savings for 1-hour movies where the same location establishing
shot or character reference may be generated multiple times.
"""

import hashlib
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# In-memory cache keyed by prompt hash. In production, use Redis or DB.
_cache: dict[str, dict] = {}


def _hash_prompt(prompt: str, model: str = "") -> str:
    """Generate a deterministic hash for a generation prompt."""
    key = f"{model}:{prompt}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def get_cached(prompt: str, model: str = "") -> Optional[dict]:
    """Look up a cached generation result by prompt hash.

    Returns the cached result dict (with output_url) or None.
    """
    key = _hash_prompt(prompt, model)
    result = _cache.get(key)
    if result:
        logger.info(f"Cache hit for prompt hash {key}")
    return result


def set_cached(prompt: str, model: str, result: dict) -> None:
    """Store a generation result in the cache."""
    key = _hash_prompt(prompt, model)
    _cache[key] = result
    logger.info(f"Cached result for prompt hash {key}")


def get_cache_stats() -> dict:
    """Return cache statistics."""
    return {
        "entries": len(_cache),
        "prompts": list(_cache.keys()),
    }


def clear_cache() -> None:
    """Clear the entire cache."""
    _cache.clear()
