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
    page: int = Query(1, ge=1, le=100),
    page_size: int = Query(20, ge=1, le=150),
    sort: str = Query("popular"),
    commercial_only: bool = Query(True),
):
    await check_rate_limit(request)

    if not settings.PIXABAY_API_KEY:
        return JSONResponse(
            {"error": "Pixabay API key not configured. Set PIXABAY_API_KEY."},
            status_code=400,
        )

    is_songs = type == "songs"

    params: dict[str, str] = {
        "key": settings.PIXABAY_API_KEY,
        "q": q or ("music" if is_songs else "sound effect"),
        "per_page": str(min(page_size, 200)),
        "page": str(page),
        "order": "popular" if sort in ("popular", "downloads") else "latest",
    }

    # Pixabay doesn't have an audio endpoint, so we search videos filtered by
    # category=music for songs and short-duration videos for sound effects.
    if is_songs:
        params["category"] = "music"
    # else: no category — query "sound effect" + duration filter handles SFX

    client = await get_http_client()
    url = "https://pixabay.com/api/videos/"

    try:
        response = await client.get(url, params=params)
    except httpx.HTTPError:
        return JSONResponse({"error": "Failed to search sounds"}, status_code=502)

    if response.status_code != 200:
        return JSONResponse({"error": "Failed to search sounds"}, status_code=response.status_code)

    data = response.json()
    hits = data.get("hits", [])

    # Filter by duration: effects <= 30s, songs > 10s
    if is_songs:
        hits = [h for h in hits if h.get("duration", 0) > 10]
    else:
        hits = [h for h in hits if h.get("duration", 0) <= 60]

    transformed_results = [_transform_pixabay_hit(h) for h in hits]

    total = data.get("totalHits", 0)
    has_next = page * page_size < total

    return {
        "count": total,
        "next": f"page={page + 1}" if has_next else None,
        "previous": f"page={page - 1}" if page > 1 else None,
        "results": transformed_results,
        "query": q or "",
        "type": type or "effects",
        "page": page,
        "pageSize": page_size,
        "sort": sort,
    }


def _transform_pixabay_hit(hit: dict) -> dict:
    videos = hit.get("videos", {})
    # For download/timeline: prefer small or medium quality
    download_file = videos.get("small") or videos.get("medium") or videos.get("tiny") or {}
    download_url = download_file.get("url", "")

    # For preview playback: use tiny/small video URL (not an image thumbnail)
    preview_file = videos.get("tiny") or videos.get("small") or download_file
    preview_url = preview_file.get("url", "")

    tags = hit.get("tags", "")
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if isinstance(tags, str) else tags
    name = tag_list[0].title() if tag_list else f"Sound {hit.get('id', '')}"

    return {
        "id": hit.get("id", 0),
        "name": name,
        "description": tags if isinstance(tags, str) else ", ".join(tags),
        "url": hit.get("pageURL", ""),
        "previewUrl": preview_url,
        "downloadUrl": download_url,
        "duration": hit.get("duration", 0),
        "filesize": download_file.get("size", 0),
        "type": "video",
        "channels": 0,
        "bitrate": 0,
        "bitdepth": 0,
        "samplerate": 0,
        "username": hit.get("user", ""),
        "tags": tag_list,
        "license": "Pixabay License",
        "created": "",
        "downloads": hit.get("downloads", 0),
        "rating": 0,
        "ratingCount": 0,
    }
