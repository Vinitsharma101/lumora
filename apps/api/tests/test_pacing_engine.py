"""Tests for the pacing engine service."""

from app.services.pacing_engine import analyze_pacing


class TestAnalyzePacing:

    def test_analyze_empty_timeline(self):
        """Empty/invalid timeline returns score 0."""
        result = analyze_pacing({}, {}, [])
        assert result["overall_score"] == 0
        assert "No timeline to analyze" in result["issues"]

        result = analyze_pacing(None, {}, [])
        assert result["overall_score"] == 0

    def test_analyze_healthy_timeline(self, mock_timeline):
        """A well-structured timeline should score reasonably high."""
        style = {
            "pacing": {
                "clip_duration_talking_head": [4.0, 8.0],
                "clip_duration_broll": [3.0, 6.0],
                "cuts_per_minute": [6.0, 15.0],
                "transition_palette": {"cut": 0.75},
            },
            "audio": {},
            "captions": {"enabled": False},
        }
        result = analyze_pacing(mock_timeline, style, [])

        assert result["overall_score"] > 50
        assert result["metrics"]["total_clips"] == 6
        assert result["metrics"]["avg_clip_duration_sec"] == 5.0

    def test_dull_segment_detection(self):
        """Clips exceeding fatigue threshold should be flagged."""
        timeline = {
            "total_duration": 30,
            "tracks": {
                "video": [
                    {"id": "c1", "duration": 20, "startTime": 0, "transition_in": "cut"},
                ],
                "audio": [],
                "music": [],
                "text": [],
                "captions": [],
            },
        }
        style = {
            "pacing": {
                "clip_duration_talking_head": [4.0, 8.0],
                "clip_duration_broll": [3.0, 6.0],
                "cuts_per_minute": [6.0, 12.0],
                "transition_palette": {},
            },
            "audio": {},
            "captions": {"enabled": False},
        }
        result = analyze_pacing(timeline, style, [])

        assert len(result["dull_segments"]) == 1
        assert result["dull_segments"][0]["duration"] == 20

    def test_cuts_per_minute_calculation(self, mock_timeline):
        """Cuts per minute should be computed correctly."""
        style = {
            "pacing": {
                "clip_duration_talking_head": [4.0, 8.0],
                "clip_duration_broll": [3.0, 6.0],
                "cuts_per_minute": [6.0, 15.0],
                "transition_palette": {},
            },
            "audio": {},
            "captions": {"enabled": False},
        }
        result = analyze_pacing(mock_timeline, style, [])

        # 6 clips / 30s * 60 = 12 cuts/min
        assert result["metrics"]["cuts_per_minute"] == 12.0

    def test_accepts_dict_scene_plan(self, mock_timeline, mock_scene_plan_dict):
        """Pacing engine should accept dict scene plan with 'scenes' key."""
        style = {
            "pacing": {
                "clip_duration_talking_head": [4.0, 8.0],
                "clip_duration_broll": [3.0, 6.0],
                "cuts_per_minute": [6.0, 15.0],
                "transition_palette": {},
            },
            "audio": {},
            "captions": {"enabled": False},
        }
        # Should not raise
        result = analyze_pacing(mock_timeline, style, mock_scene_plan_dict)
        assert result["overall_score"] > 0

    def test_accepts_list_scene_plan(self, mock_timeline, mock_scene_plan_list):
        """Pacing engine should accept list scene plan (legacy format)."""
        style = {
            "pacing": {
                "clip_duration_talking_head": [4.0, 8.0],
                "clip_duration_broll": [3.0, 6.0],
                "cuts_per_minute": [6.0, 15.0],
                "transition_palette": {},
            },
            "audio": {},
            "captions": {"enabled": False},
        }
        result = analyze_pacing(mock_timeline, style, mock_scene_plan_list)
        assert result["overall_score"] > 0
