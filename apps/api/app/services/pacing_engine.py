"""
Pacing Engine — Scores and validates timeline rhythm post-assembly.

Analyzes the assembled timeline against the style profile to detect:
- Dull segments (too long without visual change)
- Rhythm inconsistencies (cuts too fast/slow for the content type)
- Audio imbalances (missing music, dialog gaps)
- Visual fatigue (same shot type too long)

Outputs a pacing_report with suggestions for the ReviewAgent.
"""

import logging

logger = logging.getLogger(__name__)


def analyze_pacing(timeline: dict, style_profile, scene_plan) -> dict:
    """Score the assembled timeline's pacing against professional standards.

    Accepts style_profile as either a StyleProfile dataclass or a dict.

    Returns a pacing report with:
    - overall_score (0-100)
    - issues (list of detected problems)
    - suggestions (list of improvement recommendations)
    - metrics (quantitative measurements)
    """
    if not timeline or not isinstance(timeline, dict):
        return {"overall_score": 0, "issues": ["No timeline to analyze"], "suggestions": [], "metrics": {}}

    # Normalize style_profile to dict for uniform access
    if hasattr(style_profile, "to_dict"):
        style_profile = style_profile.to_dict()
    elif hasattr(style_profile, "__dataclass_fields__"):
        from dataclasses import asdict
        style_profile = asdict(style_profile)
    elif not isinstance(style_profile, dict):
        style_profile = {}

    # Normalize scene_plan — accept either a dict with "scenes" or a bare list
    if isinstance(scene_plan, dict):
        scene_plan = scene_plan.get("scenes", [])
    elif not isinstance(scene_plan, list):
        scene_plan = []

    tracks = timeline.get("tracks", {})
    total_duration = timeline.get("total_duration", 0)
    pacing_config = style_profile.get("pacing", {})
    audio_config = style_profile.get("audio", {})

    issues = []
    suggestions = []
    score = 100

    # ── Metric: Average clip duration ────────────────────────────────
    video_clips = tracks.get("video", [])
    if video_clips:
        durations = [c.get("duration", 0) for c in video_clips]
        avg_clip_dur = sum(durations) / len(durations)
        min_clip_dur = min(durations)
        max_clip_dur = max(durations)

        # Check against profile's expected range
        talking_range = pacing_config.get("clip_duration_talking_head", [4.0, 8.0])
        expected_avg = (talking_range[0] + talking_range[1]) / 2

        if avg_clip_dur > talking_range[1] * 1.5:
            issues.append(f"Average clip duration ({avg_clip_dur:.1f}s) is too long for this style")
            suggestions.append("Shorten clips or add more cuts to increase energy")
            score -= 10
        elif avg_clip_dur < talking_range[0] * 0.5:
            issues.append(f"Average clip duration ({avg_clip_dur:.1f}s) is too short — may feel choppy")
            suggestions.append("Lengthen some clips to let moments breathe")
            score -= 8
    else:
        issues.append("No video clips in timeline")
        score -= 30
        avg_clip_dur = 0
        min_clip_dur = 0
        max_clip_dur = 0

    # ── Metric: Cuts per minute ──────────────────────────────────────
    if total_duration > 0 and video_clips:
        cuts_per_min = (len(video_clips) / total_duration) * 60
        target_range = pacing_config.get("cuts_per_minute", [6.0, 12.0])

        if cuts_per_min < target_range[0]:
            issues.append(f"Cut rate ({cuts_per_min:.1f}/min) below target ({target_range[0]}-{target_range[1]}/min)")
            suggestions.append("Add more cuts or split long shots into sub-clips")
            score -= 8
        elif cuts_per_min > target_range[1]:
            issues.append(f"Cut rate ({cuts_per_min:.1f}/min) above target — may feel hyperactive")
            suggestions.append("Merge some rapid cuts into longer holds")
            score -= 5
    else:
        cuts_per_min = 0

    # ── Metric: Visual fatigue detection ─────────────────────────────
    dull_segments = []
    if video_clips:
        for clip in video_clips:
            dur = clip.get("duration", 0)
            broll_range = pacing_config.get("clip_duration_broll", [3.0, 6.0])
            fatigue_threshold = broll_range[1] * 1.5

            if dur > fatigue_threshold:
                dull_segments.append({
                    "clip_id": clip.get("id", "unknown"),
                    "duration": dur,
                    "start_time": clip.get("startTime", 0),
                })

    if dull_segments:
        issues.append(f"{len(dull_segments)} clips exceed visual fatigue threshold")
        suggestions.append("Consider adding B-roll or splitting these long clips")
        score -= min(len(dull_segments) * 3, 15)

    # ── Metric: Audio coverage ───────────────────────────────────────
    audio_clips = tracks.get("audio", [])
    music_clips = tracks.get("music", [])

    dialog_coverage = 0
    for clip in audio_clips:
        if clip.get("type") == "voiceover":
            dialog_coverage += clip.get("duration", 0)

    music_coverage = sum(c.get("duration", 0) for c in music_clips)

    if total_duration > 0:
        dialog_pct = (dialog_coverage / total_duration) * 100
        music_pct = (music_coverage / total_duration) * 100

        if dialog_pct < 30 and scene_plan:
            has_dialog = any(s.get("dialog") or s.get("voiceover") for s in scene_plan)
            if has_dialog:
                issues.append(f"Dialog covers only {dialog_pct:.0f}% of timeline")
                score -= 5

        if music_pct < 50:
            suggestions.append("Consider extending background music for better atmosphere")
            score -= 3
    else:
        dialog_pct = 0
        music_pct = 0

    # ── Metric: Transition variety ───────────────────────────────────
    transitions = [c.get("transition_in", "cut") for c in video_clips]
    if transitions:
        cut_pct = transitions.count("cut") / len(transitions) * 100
        target_palette = pacing_config.get("transition_palette", {})
        expected_cut_pct = target_palette.get("cut", 0.7) * 100

        if cut_pct > 95 and expected_cut_pct < 80:
            suggestions.append("Add variety with dissolves or fades between key moments")
            score -= 3

    # ── Metric: Text/caption coverage ────────────────────────────────
    text_clips = tracks.get("text", [])
    caption_clips = tracks.get("captions", [])
    has_captions = len(caption_clips) > 0 or len(text_clips) > 0

    caption_config = style_profile.get("captions", {})
    if caption_config.get("enabled", True) and not has_captions and dialog_coverage > 0:
        issues.append("Captions enabled in profile but none generated")
        suggestions.append("Ensure CaptionAgent runs after dialog generation")
        score -= 5

    # ── Metric: Pacing momentum ──────────────────────────────────────
    momentum_issues = 0
    if len(video_clips) >= 3:
        for idx in range(1, len(video_clips) - 1):
            prev_dur = video_clips[idx - 1].get("duration", 5)
            curr_dur = video_clips[idx].get("duration", 5)
            next_dur = video_clips[idx + 1].get("duration", 5)

            # Check for jarring pace changes (>3x duration difference)
            if curr_dur > prev_dur * 3 or curr_dur < prev_dur / 3:
                momentum_issues += 1

    if momentum_issues > 2:
        issues.append(f"{momentum_issues} jarring pace changes detected (>3x duration jump)")
        suggestions.append("Smooth duration transitions between adjacent clips")
        score -= min(momentum_issues * 2, 10)

    score = max(0, min(100, score))

    return {
        "overall_score": score,
        "issues": issues,
        "suggestions": suggestions,
        "dull_segments": dull_segments,
        "metrics": {
            "total_duration_sec": round(total_duration, 1),
            "total_clips": len(video_clips),
            "avg_clip_duration_sec": round(avg_clip_dur, 2),
            "min_clip_duration_sec": round(min_clip_dur, 2),
            "max_clip_duration_sec": round(max_clip_dur, 2),
            "cuts_per_minute": round(cuts_per_min, 1),
            "dialog_coverage_pct": round(dialog_pct, 1),
            "music_coverage_pct": round(music_pct, 1),
            "caption_count": len(caption_clips) + len(text_clips),
            "transition_types": list(set(transitions)) if transitions else [],
            "dull_segment_count": len(dull_segments),
            "momentum_issues": momentum_issues,
        }
    }
