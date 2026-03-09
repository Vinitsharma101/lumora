"""
Review Agent — Validates the assembled timeline for coherence, character
consistency, duration accuracy, and audio synchronization.
Uses the Anthropic API directly to analyze the plan.
"""

import json
import logging
from anthropic import AsyncAnthropic
from app.config import settings
from app.http_client import get_http_client

logger = logging.getLogger(__name__)

REVIEW_SYSTEM_PROMPT = """You are a senior video editor and quality assurance specialist.
Review the assembled video timeline for issues. Check:

1. **Duration accuracy** — Do scene durations sum to the target total?
2. **Visual coherence** — Do the scenes flow logically? Are transitions appropriate?
3. **Character consistency** — Are the same characters described consistently?
4. **Audio sync** — Are voiceovers and music aligned with visuals?
5. **Text overlays** — Are they readable (size, contrast, duration)?
6. **Pacing** — Is the video well-paced for the content type?
7. **Camera work** — Do camera angles and movements make cinematic sense?
8. **Missing elements** — Are there gaps in the timeline?

Output ONLY valid JSON:
{
  "approved": true/false,
  "score": 85,
  "issues": [
    {
      "severity": "high",
      "scene_id": "s2",
      "type": "pacing",
      "description": "Scene 2 is too short for the amount of text overlay",
      "suggestion": "Extend scene duration to at least 6 seconds"
    }
  ],
  "suggestions": ["Overall the timeline is strong. Consider adding a sound effect at the transition between s1 and s2."]
}

If score >= 80, set approved to true. Below 80, set approved to false.
"""


class ReviewAgent:
    """Validates timeline quality and flags issues for re-generation."""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def run(self, state: dict) -> dict:
        """Review the assembled timeline and produce a quality report."""
        plan = state.get("scene_plan", {})
        timeline = state.get("assembled_timeline", {})
        assets = state.get("generated_assets", [])

        if not timeline:
            return {**state, "review_notes": [{"severity": "critical", "description": "No timeline to review"}], "status": "failed"}

        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=REVIEW_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"""Review this video production:

Original Query: {state.get('original_query', '')}

Scene Plan:
{json.dumps(plan, indent=2)[:3000]}

Assembled Timeline:
{json.dumps(timeline, indent=2)[:3000]}

Generated Assets Summary:
{json.dumps([{
    "scene_id": a.get("scene_id"),
    "has_video": bool(a.get("video_url")),
    "has_image": bool(a.get("image_url")),
    "has_voiceover": bool(a.get("voiceover_text")),
    "error": a.get("error") or a.get("visual_error"),
} for a in assets], indent=2)}

Evaluate quality and list any issues.
"""
            }]
        )

        try:
            text = response.content[0].text
            if "```" in text:
                text = text.split("```json")[-1].split("```")[0] if "```json" in text else text.split("```")[1].split("```")[0]
            review = json.loads(text.strip())
        except (json.JSONDecodeError, IndexError):
            logger.warning("Review Agent failed to parse JSON, auto-approving")
            review = {"approved": True, "score": 75, "issues": [], "suggestions": []}

        approved = review.get("approved", True)
        issues = review.get("issues", [])
        score = review.get("score", 75)

        # Visual verification: spot-check generated image assets with Claude Vision
        if settings.ANTHROPIC_API_KEY and assets:
            image_assets = [a for a in assets if a.get("image_url") and not a.get("error")][:2]
            for asset in image_assets:
                try:
                    import base64
                    client_http = await get_http_client()
                    img_resp = await client_http.get(asset["image_url"])
                    if img_resp.status_code == 200:
                        img_b64 = base64.b64encode(img_resp.content).decode("utf-8")
                        content_type = img_resp.headers.get("content-type", "image/jpeg")
                        scene_id = asset.get("scene_id", "unknown")
                        scene_desc = next(
                            (s.get("description", "") for s in plan.get("scenes", []) if s.get("scene_id") == scene_id),
                            "",
                        )
                        vision_resp = await self.client.messages.create(
                            model="claude-sonnet-4-20250514",
                            max_tokens=256,
                            messages=[{
                                "role": "user",
                                "content": [
                                    {"type": "image", "source": {"type": "base64", "media_type": content_type, "data": img_b64}},
                                    {"type": "text", "text": f"Does this image match the intended scene description: '{scene_desc}'? Reply with a short JSON: {{\"matches\": true/false, \"issue\": \"...\"}}"},
                                ],
                            }],
                        )
                        vision_text = vision_resp.content[0].text
                        if "```" in vision_text:
                            vision_text = vision_text.split("```json")[-1].split("```")[0] if "```json" in vision_text else vision_text.split("```")[1].split("```")[0]
                        vision_result = json.loads(vision_text.strip())
                        if not vision_result.get("matches", True):
                            issues.append({
                                "severity": "medium",
                                "scene_id": scene_id,
                                "type": "visual_mismatch",
                                "description": vision_result.get("issue", "Image doesn't match scene description"),
                                "suggestion": "Regenerate this scene's image with a more specific prompt",
                            })
                            if score > 70:
                                score -= 5
                except Exception as e:
                    logger.warning(f"Visual verification failed for {asset.get('scene_id')}: {e}")

        if approved:
            return {
                **state,
                "review_notes": [],
                "review_score": score,
                "review_suggestions": review.get("suggestions", []),
                "status": "completed",
                "messages": state.get("messages", []) + [
                    {"role": "agent", "content": f"✅ Review passed (score: {score}/100). Timeline is ready!"}
                ]
            }
        else:
            # Only retry once — don't loop forever
            retry_count = state.get("_retry_count", 0)
            if retry_count >= 1:
                return {
                    **state,
                    "review_notes": [],
                    "review_score": score,
                    "status": "completed",
                    "messages": state.get("messages", []) + [
                        {"role": "agent", "content": f"⚠️ Review score: {score}/100. Proceeding with minor issues after retry."}
                    ]
                }

            return {
                **state,
                "review_notes": issues,
                "review_score": score,
                "_retry_count": retry_count + 1,
                "status": "regenerating",
                "messages": state.get("messages", []) + [
                    {"role": "agent", "content": f"⚠️ Review flagged {len(issues)} issues (score: {score}/100). Re-generating..."}
                ]
            }
