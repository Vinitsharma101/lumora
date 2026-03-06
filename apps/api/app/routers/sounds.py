import httpx
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.http_client import get_http_client
from app.rate_limit import check_rate_limit

router = APIRouter(tags=["sounds"])


@router.get("/api/sounds/search")
async def search_sounds(
    request: Request,
    q: str | None = Query(None),
    type: str | None = Query(None),
    page: int = Query(1, ge=1, le=1000),
    page_size: int = Query(20, ge=1, le=150),
    sort: str = Query("downloads"),
    min_rating: float = Query(3, ge=0, le=5),
    commercial_only: bool = Query(True),
):
    await check_rate_limit(request)

    if not settings.FREESOUND_API_KEY:
        return JSONResponse(
            {"error": "Freesound API key not configured. Set FREESOUND_API_KEY."},
            status_code=400,
        )

    if type == "songs":
        return JSONResponse(
            {
                "error": "Songs are not available yet",
                "message": "Song search functionality is coming soon. Try searching for sound effects instead.",
            },
            status_code=501,
        )

    sort_param = _build_sort_parameter(q, sort)

    params = {
        "query": q or "",
        "token": settings.FREESOUND_API_KEY,
        "page": str(page),
        "page_size": str(page_size),
        "sort": sort_param,
        "fields": (
            "id,name,description,url,previews,download,duration,filesize,"
            "type,channels,bitrate,bitdepth,samplerate,username,tags,"
            "license,created,num_downloads,avg_rating,num_ratings"
        ),
    }

    is_effects_search = type == "effects" or type is None
    filters = []
    if is_effects_search:
        filters = _build_effects_filters(min_rating, commercial_only)

    client = await get_http_client()
    url = "https://freesound.org/apiv2/search/text/"

    # Build URL with filters
    query_parts = [f"{k}={v}" for k, v in params.items()]
    for f in filters:
        query_parts.append(f"filter={f}")
    full_url = f"{url}?{'&'.join(query_parts)}"

    try:
        response = await client.get(full_url)
    except httpx.HTTPError:
        return JSONResponse({"error": "Failed to search sounds"}, status_code=502)

    if response.status_code != 200:
        return JSONResponse({"error": "Failed to search sounds"}, status_code=response.status_code)

    data = response.json()

    transformed_results = [_transform_result(r) for r in data.get("results", [])]

    return {
        "count": data.get("count", 0),
        "next": data.get("next"),
        "previous": data.get("previous"),
        "results": transformed_results,
        "query": q or "",
        "type": type or "effects",
        "page": page,
        "pageSize": page_size,
        "sort": sort,
        "minRating": min_rating,
    }


def _build_sort_parameter(query: str | None, sort: str) -> str:
    if not query:
        return f"{sort}_desc"
    return "score" if sort == "score" else f"{sort}_desc"


def _build_effects_filters(min_rating: float, commercial_only: bool) -> list[str]:
    filters = [
        "duration:[* TO 30.0]",
        f"avg_rating:[{min_rating} TO *]",
    ]

    if commercial_only:
        filters.append(
            'license:("Attribution" OR "Creative Commons 0" OR "Attribution Noncommercial" OR "Attribution Commercial")'
        )

    filters.append(
        "tag:sound-effect OR tag:sfx OR tag:foley OR tag:ambient OR tag:nature "
        "OR tag:mechanical OR tag:electronic OR tag:impact OR tag:whoosh OR tag:explosion"
    )

    return filters


def _transform_result(result: dict) -> dict:
    previews = result.get("previews") or {}
    return {
        "id": result.get("id"),
        "name": result.get("name", ""),
        "description": result.get("description", ""),
        "url": result.get("url", ""),
        "previewUrl": previews.get("preview-hq-mp3") or previews.get("preview-lq-mp3"),
        "downloadUrl": result.get("download"),
        "duration": result.get("duration", 0),
        "filesize": result.get("filesize", 0),
        "type": result.get("type", ""),
        "channels": result.get("channels", 0),
        "bitrate": result.get("bitrate", 0),
        "bitdepth": result.get("bitdepth", 0),
        "samplerate": result.get("samplerate", 0),
        "username": result.get("username", ""),
        "tags": result.get("tags", []),
        "license": result.get("license", ""),
        "created": result.get("created", ""),
        "downloads": result.get("num_downloads", 0),
        "rating": result.get("avg_rating", 0),
        "ratingCount": result.get("num_ratings", 0),
    }
