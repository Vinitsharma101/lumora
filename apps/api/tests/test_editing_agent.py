"""Tests for the editing agent."""

import pytest

from app.agents.editing_agent import EditingAgent


class TestEditingAgent:

    @pytest.mark.asyncio
    async def test_run_with_valid_plan(self, mock_state):
        """Agent should produce an assembled timeline from a valid state."""
        agent = EditingAgent()
        result = await agent.run(mock_state)

        assert "assembled_timeline" in result
        assert result["status"] == "reviewing"
        timeline = result["assembled_timeline"]
        assert len(timeline["tracks"]["video"]) == 3

    @pytest.mark.asyncio
    async def test_run_with_empty_scenes_returns_error(self):
        """No scenes in plan should return error."""
        state = {"scene_plan": {"scenes": []}}
        agent = EditingAgent()
        result = await agent.run(state)

        assert result["status"] == "failed"
        assert "No scenes" in result["error"]

    @pytest.mark.asyncio
    async def test_run_with_no_plan_returns_error(self):
        """Missing scene_plan should return error."""
        state = {}
        agent = EditingAgent()
        result = await agent.run(state)

        assert result["status"] == "failed"

    @pytest.mark.asyncio
    async def test_timeline_tracks_populated(self, mock_state):
        """All expected track types should exist in the timeline."""
        agent = EditingAgent()
        result = await agent.run(mock_state)
        timeline = result["assembled_timeline"]

        expected_tracks = {"video", "overlay", "audio", "music", "text", "effects", "captions"}
        assert set(timeline["tracks"].keys()) == expected_tracks

    @pytest.mark.asyncio
    async def test_voiceover_added_to_audio_track(self, mock_state):
        """Scenes with voiceover should produce audio track entries."""
        agent = EditingAgent()
        result = await agent.run(mock_state)
        audio = result["assembled_timeline"]["tracks"]["audio"]

        # s1 and s2 have voiceover
        vo_entries = [a for a in audio if a["type"] == "voiceover"]
        assert len(vo_entries) == 2

    @pytest.mark.asyncio
    async def test_text_overlays_get_responsive_sizing(self, mock_state):
        """Text overlays should have fontSize set by responsive sizing."""
        agent = EditingAgent()
        result = await agent.run(mock_state)
        text_clips = result["assembled_timeline"]["tracks"]["text"]

        assert len(text_clips) == 1
        assert "fontSize" in text_clips[0]
        assert text_clips[0]["fontSize"] > 0
