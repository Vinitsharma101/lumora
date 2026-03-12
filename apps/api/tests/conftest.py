"""Shared test fixtures for API tests."""

import pytest


@pytest.fixture
def mock_scene_plan_dict():
    """Scene plan as returned by planning_agent (dict with 'scenes' key)."""
    return {
        "title": "Test Video",
        "total_duration": 15,
        "resolution": {"width": 1920, "height": 1080},
        "scenes": [
            {
                "scene_id": "s1",
                "description": "Opening shot",
                "duration": 5,
                "voiceover": {"text": "Welcome to the show", "voice_style": "narrator"},
                "shots": [{"id": "shot1"}, {"id": "shot2"}],
                "text_overlays": [{"content": "Title", "role": "title"}],
            },
            {
                "scene_id": "s2",
                "description": "Main content",
                "duration": 5,
                "voiceover": {"text": "Here is the main point of this video"},
                "shots": [{"id": "shot3"}],
                "text_overlays": [],
            },
            {
                "scene_id": "s3",
                "description": "Closing",
                "duration": 5,
                "dialog": [{"line": "Subscribe now!"}],
                "shots": [],
                "text_overlays": [],
            },
        ],
        "music_track": {"description": "Upbeat background", "bpm": 120, "mood": "energetic"},
        "sound_effects": [],
    }


@pytest.fixture
def mock_scene_plan_list():
    """Scene plan as a flat list (legacy format)."""
    return [
        {
            "scene_id": "s1",
            "description": "Opening",
            "duration": 5,
            "dialog": [{"line": "Hello world"}],
            "shots": [{"id": "shot1"}],
        },
        {
            "scene_id": "s2",
            "description": "Closing",
            "duration": 5,
            "dialog": [],
            "shots": [],
        },
    ]


@pytest.fixture
def mock_state(mock_scene_plan_dict):
    """Full pipeline state dict."""
    return {
        "scene_plan": mock_scene_plan_dict,
        "show_bible": {
            "characters": [
                {"id": "c1", "name": "Host"},
                {"id": "c2", "name": "Guest"},
            ]
        },
        "generated_assets": [
            {"scene_id": "s1", "video_url": "https://example.com/v1.mp4"},
            {"scene_id": "s2", "image_url": "https://example.com/i2.png"},
            {"scene_id": "s3", "video_url": "https://example.com/v3.mp4"},
        ],
        "style_profile": {
            "name": "youtube",
            "target_fps": 30,
            "pacing": {
                "clip_duration_talking_head": [4.0, 8.0],
                "clip_duration_broll": [3.0, 6.0],
                "cuts_per_minute": [8.0, 15.0],
                "transition_palette": {"cut": 0.75, "dissolve": 0.15, "fade": 0.1},
            },
            "audio": {
                "volume_dialog": 1.0,
                "volume_music": 0.3,
                "volume_sfx": 0.7,
            },
            "captions": {"enabled": True},
        },
        "content_type": "youtube",
    }


@pytest.fixture
def mock_timeline():
    """Assembled timeline for pacing tests."""
    return {
        "total_duration": 30,
        "tracks": {
            "video": [
                {"id": "c1", "type": "video", "startTime": 0,
                 "duration": 5, "transition_in": "cut"},
                {"id": "c2", "type": "video", "startTime": 5,
                 "duration": 5, "transition_in": "dissolve"},
                {"id": "c3", "type": "video", "startTime": 10,
                 "duration": 5, "transition_in": "cut"},
                {"id": "c4", "type": "video", "startTime": 15,
                 "duration": 5, "transition_in": "cut"},
                {"id": "c5", "type": "video", "startTime": 20,
                 "duration": 5, "transition_in": "fade"},
                {"id": "c6", "type": "video", "startTime": 25,
                 "duration": 5, "transition_in": "cut"},
            ],
            "audio": [
                {"id": "vo1", "type": "voiceover", "startTime": 0, "duration": 20},
            ],
            "music": [
                {"id": "m1", "type": "music", "startTime": 0, "duration": 30},
            ],
            "text": [
                {"id": "t1", "startTime": 0, "duration": 5},
            ],
            "captions": [],
        },
    }
