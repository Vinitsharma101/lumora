"""Tests for the sounds search router."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.routers.sounds import _transform_pixabay_hit


class TestSearchSoundsParams:
    """Verify that search_sounds builds correct Pixabay API params."""

    @pytest.fixture
    def mock_pixabay_response(self):
        mock = MagicMock()
        mock.status_code = 200
        mock.json.return_value = {
            "totalHits": 2,
            "hits": [
                {"id": 1, "duration": 120, "tags": "piano, calm", "videos": {}, "downloads": 10},
                {"id": 2, "duration": 5, "tags": "click, ui", "videos": {}, "downloads": 20},
            ],
        }
        return mock

    @pytest.mark.asyncio
    async def test_search_songs_sets_music_category(self, mock_pixabay_response):
        """Songs search should include category=music."""
        from app.routers.sounds import search_sounds

        captured_params = {}

        async def mock_get(url, params=None):
            captured_params.update(params or {})
            return mock_pixabay_response

        mock_client = AsyncMock()
        mock_client.get = mock_get

        with (
            patch("app.routers.sounds.settings") as mock_settings,
            patch("app.routers.sounds.get_http_client", return_value=mock_client),
            patch("app.routers.sounds.check_rate_limit", new_callable=AsyncMock),
        ):
            mock_settings.PIXABAY_API_KEY = "test-key"
            request = MagicMock()
            await search_sounds(
                request, q="piano", type="songs",
                page=1, page_size=20, sort="popular", commercial_only=True,
            )

        assert captured_params.get("category") == "music"

    @pytest.mark.asyncio
    async def test_search_effects_omits_category(self, mock_pixabay_response):
        """Sound effects search should NOT set category (Fix 1 validation)."""
        from app.routers.sounds import search_sounds

        captured_params = {}

        async def mock_get(url, params=None):
            captured_params.update(params or {})
            return mock_pixabay_response

        mock_client = AsyncMock()
        mock_client.get = mock_get

        with (
            patch("app.routers.sounds.settings") as mock_settings,
            patch("app.routers.sounds.get_http_client", return_value=mock_client),
            patch("app.routers.sounds.check_rate_limit", new_callable=AsyncMock),
        ):
            mock_settings.PIXABAY_API_KEY = "test-key"
            request = MagicMock()
            await search_sounds(
                request, q="explosion", type="effects",
                page=1, page_size=20, sort="popular", commercial_only=True,
            )

        assert "category" not in captured_params

    @pytest.mark.asyncio
    async def test_search_no_api_key_returns_error(self):
        """Missing API key should return 400."""
        from app.routers.sounds import search_sounds

        with (
            patch("app.routers.sounds.settings") as mock_settings,
            patch("app.routers.sounds.check_rate_limit", new_callable=AsyncMock),
        ):
            mock_settings.PIXABAY_API_KEY = ""
            request = MagicMock()
            result = await search_sounds(
                request, q=None, type=None,
                page=1, page_size=20, sort="popular", commercial_only=True,
            )

        assert result.status_code == 400

    @pytest.mark.asyncio
    async def test_songs_filter_by_duration_gt_10(self, mock_pixabay_response):
        """Songs should filter hits to duration > 10s."""
        from app.routers.sounds import search_sounds

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_pixabay_response)

        with (
            patch("app.routers.sounds.settings") as mock_settings,
            patch("app.routers.sounds.get_http_client", return_value=mock_client),
            patch("app.routers.sounds.check_rate_limit", new_callable=AsyncMock),
        ):
            mock_settings.PIXABAY_API_KEY = "test-key"
            request = MagicMock()
            result = await search_sounds(
                request, q=None, type="songs",
                page=1, page_size=20, sort="popular", commercial_only=True,
            )

        # Only the hit with duration=120 should pass (duration > 10)
        assert len(result["results"]) == 1

    @pytest.mark.asyncio
    async def test_effects_filter_by_duration_lte_60(self, mock_pixabay_response):
        """Effects should filter hits to duration <= 60s."""
        from app.routers.sounds import search_sounds

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_pixabay_response)

        with (
            patch("app.routers.sounds.settings") as mock_settings,
            patch("app.routers.sounds.get_http_client", return_value=mock_client),
            patch("app.routers.sounds.check_rate_limit", new_callable=AsyncMock),
        ):
            mock_settings.PIXABAY_API_KEY = "test-key"
            request = MagicMock()
            result = await search_sounds(
                request, q=None, type="effects",
                page=1, page_size=20, sort="popular", commercial_only=True,
            )

        # Only hit with duration=5 should pass (duration <= 60)
        assert len(result["results"]) == 1


class TestTransformPixabayHit:
    """Test the hit transformer helper."""

    def test_transform_pixabay_hit(self):
        hit = {
            "id": 42,
            "tags": "thunder, storm, rain",
            "pageURL": "https://pixabay.com/42",
            "duration": 8,
            "user": "testuser",
            "downloads": 100,
            "videos": {
                "small": {"url": "https://cdn.pixabay.com/small.mp4", "size": 1024},
                "tiny": {"url": "https://cdn.pixabay.com/tiny.mp4", "size": 512},
            },
        }
        result = _transform_pixabay_hit(hit)

        assert result["id"] == 42
        assert result["name"] == "Thunder"
        assert result["duration"] == 8
        assert result["username"] == "testuser"
        assert result["downloadUrl"] == "https://cdn.pixabay.com/small.mp4"
        assert result["previewUrl"] == "https://cdn.pixabay.com/tiny.mp4"
        assert result["license"] == "Pixabay License"
        assert "thunder" in result["tags"]
