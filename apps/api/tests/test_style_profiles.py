"""Tests for style profiles."""

from app.services.style_profiles import (
    STYLE_PROFILES,
    get_all_profile_names,
    get_style_profile,
)


class TestStyleProfiles:

    def test_get_style_profile_known(self):
        """Known profile names should return the correct profile."""
        profile = get_style_profile("reel")
        assert profile.name == "reel"
        assert profile.target_aspect_ratio == "9:16"

    def test_get_style_profile_unknown_fallback(self):
        """Unknown profile should fall back to youtube."""
        profile = get_style_profile("nonexistent")
        assert profile.name == "youtube"

    def test_get_all_profile_names(self):
        """Should return all 6 profile names."""
        names = get_all_profile_names()
        assert len(names) == 6
        assert set(names) == {"reel", "youtube", "podcast", "documentary", "corporate", "cinematic"}

    def test_reel_profile_fast_pacing(self):
        """Reel profile should have faster pacing than youtube."""
        reel = get_style_profile("reel")
        youtube = get_style_profile("youtube")

        assert reel.pacing.cuts_per_minute[0] > youtube.pacing.cuts_per_minute[0]
        reel_th = reel.pacing.clip_duration_talking_head[0]
        yt_th = youtube.pacing.clip_duration_talking_head[0]
        assert reel_th < yt_th

    def test_podcast_profile_slow_pacing(self):
        """Podcast profile should have slowest pacing."""
        podcast = get_style_profile("podcast")

        assert podcast.pacing.cuts_per_minute[0] <= 3.0
        assert podcast.pacing.clip_duration_talking_head[0] >= 8.0
        assert podcast.broll.enabled is False

    def test_all_profiles_have_to_dict(self):
        """All profiles should serialize correctly."""
        for name, profile in STYLE_PROFILES.items():
            d = profile.to_dict()
            assert d["name"] == name
            assert "pacing" in d
            assert "audio" in d
            assert "captions" in d
            assert "motion" in d
            assert "broll" in d

    def test_cinematic_profile_24fps(self):
        """Cinematic and documentary should target 24fps."""
        assert get_style_profile("cinematic").target_fps == 24
        assert get_style_profile("documentary").target_fps == 24
