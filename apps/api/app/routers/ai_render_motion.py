from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.rate_limit import check_rate_limit
from app.schemas.ai import RenderMotionRequest

router = APIRouter(tags=["ai"])


@router.post("/api/ai/render-motion")
async def render_motion(body: RenderMotionRequest, request: Request):
    await check_rate_limit(request)

    return JSONResponse(
        {
            "error": (
                "Motion graphic rendering requires Remotion packages to be installed. "
                "Install 'remotion' and '@remotion/renderer' to enable this feature."
            ),
            "composition": body.compositionId,
            "props": body.props or {},
        },
        status_code=501,
    )
