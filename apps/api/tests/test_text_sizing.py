"""Tests for the text sizing service."""

from app.services.text_sizing import (
    calculate_font_size,
    calculate_text_overlay_props,
    compute_scale_factor,
    get_aspect_category,
)


class TestComputeScaleFactor:

    def test_1920x1080_returns_1(self):
        """Reference resolution should return scale factor of 1.0."""
        assert compute_scale_factor(1920, 1080) == 1.0

    def test_smaller_canvas_scales_down(self):
        """Smaller canvas should produce scale < 1."""
        scale = compute_scale_factor(1280, 720)
        assert 0.4 < scale < 1.0

    def test_clamped_minimum(self):
        """Very small canvas should clamp to 0.4."""
        scale = compute_scale_factor(100, 100)
        assert scale == 0.4

    def test_clamped_maximum(self):
        """Very large canvas should clamp to 2.5."""
        scale = compute_scale_factor(10000, 10000)
        assert scale == 2.5


class TestGetAspectCategory:

    def test_landscape(self):
        assert get_aspect_category(1920, 1080) == "landscape"

    def test_portrait(self):
        assert get_aspect_category(1080, 1920) == "portrait"

    def test_square(self):
        assert get_aspect_category(1080, 1080) == "square"

    def test_zero_height_fallback(self):
        """Zero height should not crash (falls back to ratio=1.0 → square)."""
        assert get_aspect_category(1920, 0) == "square"


class TestCalculateFontSize:

    def test_default_subtitle_1920x1080(self):
        """Subtitle at reference resolution should return the preset value."""
        size = calculate_font_size(1920, 1080)
        assert size == 48  # FONT_SIZE_PRESETS["subtitle"]

    def test_portrait_boost(self):
        """Portrait at same short-side gets a 15% boost vs without boost."""
        # At 1080x1920, scale = min(1080/1920, 1920/1080) = 0.5625
        # Without portrait boost: 48 * 0.5625 = 27 → rounded to 28
        # With portrait boost: 48 * 0.5625 * 1.15 = 31.05 → rounded to 32
        portrait = calculate_font_size(1080, 1920, role="subtitle")
        assert portrait == 32

    def test_minimum_font_size(self):
        """Font size should never go below 12px."""
        size = calculate_font_size(100, 100, role="watermark")
        assert size >= 12

    def test_custom_base_size(self):
        """Custom base_size should override preset."""
        size = calculate_font_size(1920, 1080, base_size=100)
        assert size == 100


class TestCalculateTextOverlayProps:

    def test_returns_enriched_overlay(self):
        """Should add fontSize, paddingX, paddingY, maxWidth, lineHeight."""
        overlay = {"content": "Hello", "role": "title"}
        result = calculate_text_overlay_props(1920, 1080, overlay)

        assert "fontSize" in result
        assert "paddingX" in result
        assert "paddingY" in result
        assert "maxWidth" in result
        assert "lineHeight" in result
        assert result["content"] == "Hello"

    def test_landscape_max_width(self):
        """Landscape should use 80% max width."""
        overlay = {"content": "Test"}
        result = calculate_text_overlay_props(1920, 1080, overlay)
        assert result["maxWidth"] == int(1920 * 0.80)

    def test_portrait_max_width(self):
        """Portrait should use 88% max width."""
        overlay = {"content": "Test"}
        result = calculate_text_overlay_props(1080, 1920, overlay)
        assert result["maxWidth"] == int(1080 * 0.88)
