# This router has been removed. Motion graphic rendering is handled
# by the Next.js API route at /api/render-motion which has full
# Remotion support. The FastAPI endpoint was a non-functional stub.
#
# Kept as empty module to avoid breaking imports during transition.

from fastapi import APIRouter

router = APIRouter()
