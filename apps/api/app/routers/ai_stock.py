import httpx
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response

from app.config import settings
from app.rate_limit import check_rate_limit
from app.schemas.ai import StockDownloadRequest

router = APIRouter(tags=["ai"])


@router.get("/api/ai/stock")
async def search_stock(
    request: Request,
    query: str = Query(...),
    type: str = Query("photo"),
    orientation: str | None = Query(None),
    per_page: int = Query(10),
):
    await check_rate_limit(request)

    if not settings.PEXELS_API_KEY and not settings.PIXABAY_API_KEY:
        return JSONResponse(
            {"error": "No stock media API keys configured. Set PEXELS_API_KEY or PIXABAY_API_KEY."},
            status_code=400,
        )

    results = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Search Pexels
        if settings.PEXELS_API_KEY:
            try:
                pexels_endpoint = (
                    "https://api.pexels.com/videos/search"
                    if type == "video"
                    else "https://api.pexels.com/v1/search"
                )
                params = {"query": query, "per_page": str(per_page)}
                if orientation:
                    params["orientation"] = orientation

                resp = await client.get(
                    pexels_endpoint,
                    params=params,
                    headers={"Authorization": settings.PEXELS_API_KEY},
                )

                if resp.status_code == 200:
                    data = resp.json()
                    if type == "video":
                        for item in data.get("videos", []):
                            files = item.get("video_files", [])
                            best_file = next(
                                (f for f in files if f.get("quality") == "hd"),
                                files[0] if files else None,
                            )
                            if best_file:
                                results.append({
                                    "id": f"pexels-{item['id']}",
                                    "source": "pexels",
                                    "type": "video",
                                    "url": item.get("url", ""),
                                    "previewUrl": item.get("image", ""),
                                    "downloadUrl": best_file["link"],
                                    "width": best_file["width"],
                                    "height": best_file["height"],
                                    "duration": item.get("duration"),
                                    "photographer": (item.get("user") or {}).get("name"),
                                })
                    else:
                        for item in data.get("photos", []):
                            src = item.get("src", {})
                            results.append({
                                "id": f"pexels-{item['id']}",
                                "source": "pexels",
                                "type": "photo",
                                "url": item.get("url", ""),
                                "previewUrl": src.get("medium", ""),
                                "downloadUrl": src.get("original", ""),
                                "width": item.get("width"),
                                "height": item.get("height"),
                                "photographer": item.get("photographer"),
                                "description": item.get("alt"),
                            })
            except httpx.HTTPError:
                pass

        # Search Pixabay
        if settings.PIXABAY_API_KEY:
            try:
                pixabay_endpoint = (
                    "https://pixabay.com/api/videos/"
                    if type == "video"
                    else "https://pixabay.com/api/"
                )
                params = {
                    "key": settings.PIXABAY_API_KEY,
                    "q": query,
                    "per_page": str(min(per_page, 200)),
                }
                if orientation:
                    params["orientation"] = orientation

                resp = await client.get(pixabay_endpoint, params=params)

                if resp.status_code == 200:
                    data = resp.json()
                    if type == "video":
                        for item in data.get("hits", []):
                            videos = item.get("videos", {})
                            best_video = videos.get("large") or videos.get("medium")
                            if best_video:
                                picture_id = item.get("picture_id", "")
                                results.append({
                                    "id": f"pixabay-{item['id']}",
                                    "source": "pixabay",
                                    "type": "video",
                                    "url": item.get("pageURL", ""),
                                    "previewUrl": (
                                        f"https://i.vimeocdn.com/video/{picture_id}_640x360.jpg"
                                        if picture_id
                                        else ""
                                    ),
                                    "downloadUrl": best_video["url"],
                                    "width": best_video["width"],
                                    "height": best_video["height"],
                                    "duration": item.get("duration"),
                                    "photographer": item.get("user"),
                                })
                    else:
                        for item in data.get("hits", []):
                            results.append({
                                "id": f"pixabay-{item['id']}",
                                "source": "pixabay",
                                "type": "photo",
                                "url": item.get("pageURL", ""),
                                "previewUrl": item.get("webformatURL", ""),
                                "downloadUrl": item.get("largeImageURL", ""),
                                "width": item.get("imageWidth"),
                                "height": item.get("imageHeight"),
                                "photographer": item.get("user"),
                                "description": item.get("tags"),
                            })
            except httpx.HTTPError:
                pass

    return {"results": results, "total": len(results)}


@router.post("/api/ai/stock/download")
async def download_stock(body: StockDownloadRequest, request: Request):
    await check_rate_limit(request)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(body.url)
        if response.status_code != 200:
            return JSONResponse({"error": "Failed to download media"}, status_code=502)

        content_type = "video/mp4" if body.type == "video" else "image/jpeg"
        return Response(
            content=response.content,
            media_type=content_type,
            headers={"Content-Length": str(len(response.content))},
        )
