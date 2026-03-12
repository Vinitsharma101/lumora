"""
Cost Estimator — Estimates total API costs before the pipeline starts.

Based on scene count, dialog lines, video generation calls, and audio generation.
Presented to user for approval before proceeding.
"""

import logging

logger = logging.getLogger(__name__)

# Approximate costs per API call (USD)
COST_PER_CALL = {
    "replicate_video_gen": 0.50,
    "replicate_image_gen": 0.05,
    "replicate_musicgen": 0.10,
    "replicate_whisper": 0.03,
    "replicate_lip_sync": 0.30,
    "replicate_photomaker": 0.10,
    "replicate_upscale": 0.15,
    "elevenlabs_tts_per_1k_chars": 0.30,
    "elevenlabs_sfx": 0.15,
    "claude_api_per_call": 0.05,
}


def estimate_pipeline_cost(state: dict) -> dict:
    """Estimate the total cost of running the full pipeline.

    Analyzes the scene plan and returns a breakdown.
    """
    scene_plan_raw = state.get("scene_plan", {})
    show_bible = state.get("show_bible", {})
    acts = state.get("acts", [])

    # Normalize scene_plan — planning_agent produces {"scenes": [...], "resolution": {...}}
    if isinstance(scene_plan_raw, dict):
        scenes = scene_plan_raw.get("scenes", [])
    elif isinstance(scene_plan_raw, list):
        scenes = scene_plan_raw
    else:
        scenes = []

    num_scenes = len(scenes)
    if not num_scenes:
        return {"total_estimated_usd": 0, "breakdown": {}}

    # Count shots across all scenes
    total_shots = 0
    total_dialog_lines = 0
    total_dialog_chars = 0

    for scene in scenes:
        shots = scene.get("shots", [])
        total_shots += max(len(shots), 1)

        # Planning agent uses "voiceover" with nested "text", not "dialog" with "line"
        voiceover = scene.get("voiceover", {})
        if voiceover and isinstance(voiceover, dict) and voiceover.get("text"):
            total_dialog_lines += 1
            total_dialog_chars += len(voiceover["text"])

        for dialog in scene.get("dialog", []):
            total_dialog_lines += 1
            total_dialog_chars += len(dialog.get("line", ""))

    # If no shot breakdown from director, estimate 3 shots per scene
    if total_shots == 0:
        total_shots = num_scenes * 3

    num_characters = len(show_bible.get("characters", []))

    # Calculate costs
    video_gen_cost = total_shots * COST_PER_CALL["replicate_video_gen"]
    character_ref_cost = num_characters * 4 * COST_PER_CALL["replicate_image_gen"]  # 4 angles per character
    tts_cost = (total_dialog_chars / 1000) * COST_PER_CALL["elevenlabs_tts_per_1k_chars"]
    music_cost = COST_PER_CALL["replicate_musicgen"] * max(1, num_scenes // 5)  # ~1 track per 5 scenes
    sfx_cost = num_scenes * 0.5 * COST_PER_CALL["elevenlabs_sfx"]  # ~0.5 SFX per scene
    llm_cost = (num_scenes + 3) * COST_PER_CALL["claude_api_per_call"]  # planning + director + review
    lip_sync_cost = total_dialog_lines * COST_PER_CALL["replicate_lip_sync"] * 0.3  # only some need lip sync

    total = (
        video_gen_cost + character_ref_cost + tts_cost
        + music_cost + sfx_cost + llm_cost + lip_sync_cost
    )

    breakdown = {
        "video_generation": round(video_gen_cost, 2),
        "character_references": round(character_ref_cost, 2),
        "text_to_speech": round(tts_cost, 2),
        "music_generation": round(music_cost, 2),
        "sound_effects": round(sfx_cost, 2),
        "llm_planning": round(llm_cost, 2),
        "lip_sync": round(lip_sync_cost, 2),
    }

    return {
        "total_estimated_usd": round(total, 2),
        "breakdown": breakdown,
        "counts": {
            "scenes": num_scenes,
            "shots": total_shots,
            "dialog_lines": total_dialog_lines,
            "characters": num_characters,
        },
    }
