"""
Responsive text/font sizing based on video canvas dimensions.

Calculates appropriate font sizes, padding, and positions relative to the
video resolution so text overlays remain readable across all output sizes
(e.g., 1920x1080, 1280x720, 1080x1920, 720x1280, 1080x1080).
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Base reference: all sizes are authored at 1920x1080, then scaled ──────────
REFERENCE_WIDTH = 1920
REFERENCE_HEIGHT = 1080

# ── Font size presets at 1920x1080 (base reference) ───────────────────────────
FONT_SIZE_PRESETS = {
    "title": 72,
    "subtitle": 48,
    "heading": 56,
    "body": 36,
    "caption": 32,
    "small": 24,
    "watermark": 18,
}

# ── Aspect-ratio category thresholds ─────────────────────────────────────────
ASPECT_LANDSCAPE = 1.3    # wider than 1.3:1 → landscape
ASPECT_PORTRAIT = 0.77    # narrower than ~3:4 → portrait


def compute_scale_factor(canvas_width: int, canvas_height: int) -> float:
    """Compute a uniform scale factor relative to the 1920x1080 reference.

    Uses the *shorter* dimension as the scaling anchor so text never
    overflows the frame.  Clamped to [0.4, 2.5] so extremely small or
    large canvases still get usable sizes.
    """
    # Use the geometric mean of the two ratios to balance width and height
    width_ratio = canvas_width / REFERENCE_WIDTH
    height_ratio = canvas_height / REFERENCE_HEIGHT
    scale = min(width_ratio, height_ratio)
    return max(0.4, min(scale, 2.5))


def get_aspect_category(canvas_width: int, canvas_height: int) -> str:
    """Classify the aspect ratio into landscape / portrait / square."""
    ratio = canvas_width / canvas_height if canvas_height > 0 else 1.0
    if ratio >= ASPECT_LANDSCAPE:
        return "landscape"
    if ratio <= ASPECT_PORTRAIT:
        return "portrait"
    return "square"


def calculate_font_size(
    canvas_width: int,
    canvas_height: int,
    role: str = "subtitle",
    base_size: Optional[int] = None,
) -> int:
    """Return a pixel font size appropriate for the given canvas and text role.

    Parameters
    ----------
    canvas_width, canvas_height : int
        Output video dimensions in pixels.
    role : str
        One of the FONT_SIZE_PRESETS keys (title, subtitle, heading,
        body, caption, small, watermark).  Ignored when *base_size*
        is provided.
    base_size : int | None
        If given, scale this literal pixel value instead of a preset.

    Returns
    -------
    int
        Pixel font size rounded to the nearest even number (looks
        better at common rendering scales).
    """
    reference = base_size if base_size is not None else FONT_SIZE_PRESETS.get(role, 48)
    scale = compute_scale_factor(canvas_width, canvas_height)

    # For portrait formats, bump text slightly since the narrower
    # width means fewer chars per line and readers hold phones closer.
    aspect = get_aspect_category(canvas_width, canvas_height)
    if aspect == "portrait":
        scale *= 1.15  # +15 % for portrait readability

    raw = reference * scale
    # Round to nearest even number
    rounded = int(round(raw / 2) * 2)
    return max(12, rounded)  # absolute minimum 12 px


def calculate_text_overlay_props(
    canvas_width: int,
    canvas_height: int,
    overlay: dict,
) -> dict:
    """Enrich a text overlay dict with responsive sizing properties.

    Incoming `overlay` may contain optional hints:
        content, font, size, color, position, animation, fontWeight, role

    Returns a new dict with resolved `fontSize`, `paddingX`, `paddingY`,
    `maxWidth`, and `lineHeight`.
    """
    role = overlay.get("role", "subtitle")
    base_size = overlay.get("size") or overlay.get("fontSize")

    font_size = calculate_font_size(canvas_width, canvas_height, role=role, base_size=base_size)
    scale = compute_scale_factor(canvas_width, canvas_height)
    aspect = get_aspect_category(canvas_width, canvas_height)

    # Horizontal padding as % of canvas width
    if aspect == "portrait":
        padding_x = int(canvas_width * 0.06)
        max_width_pct = 0.88
    elif aspect == "square":
        padding_x = int(canvas_width * 0.07)
        max_width_pct = 0.85
    else:  # landscape
        padding_x = int(canvas_width * 0.05)
        max_width_pct = 0.80

    padding_y = int(font_size * 0.35)
    max_width = int(canvas_width * max_width_pct)
    line_height = round(font_size * 1.4)

    return {
        **overlay,
        "fontSize": font_size,
        "paddingX": padding_x,
        "paddingY": padding_y,
        "maxWidth": max_width,
        "lineHeight": line_height,
    }


def calculate_caption_font_size(
    canvas_width: int,
    canvas_height: int,
    style: str = "default",
) -> dict:
    """Return caption styling properties for the given canvas and style preset.

    Styles:
        default  – standard subtitles near the bottom
        viral    – large, bold, centered text (TikTok/Reels style)
        karaoke  – highlighted word-by-word
        minimal  – small, unobtrusive

    Returns
    -------
    dict with fontSize, fontWeight, color, backgroundColor,
    position, maxWidth, paddingX, paddingY.
    """
    aspect = get_aspect_category(canvas_width, canvas_height)
    scale = compute_scale_factor(canvas_width, canvas_height)

    if style == "viral":
        base = 64
        weight = "900"
        color = "#FFFFFF"
        bg_color = None
        position = "center"
    elif style == "karaoke":
        base = 48
        weight = "bold"
        color = "#FFFFFF"
        bg_color = None
        position = "center"
    elif style == "minimal":
        base = 28
        weight = "normal"
        color = "#CCCCCC"
        bg_color = "rgba(0,0,0,0.5)"
        position = "bottom"
    else:  # default
        base = 36
        weight = "bold"
        color = "#FFFFFF"
        bg_color = "rgba(0,0,0,0.6)"
        position = "bottom"

    font_size = calculate_font_size(canvas_width, canvas_height, base_size=base)

    if aspect == "portrait":
        padding_x = int(canvas_width * 0.06)
        max_width = int(canvas_width * 0.90)
    else:
        padding_x = int(canvas_width * 0.05)
        max_width = int(canvas_width * 0.80)

    return {
        "fontSize": font_size,
        "fontWeight": weight,
        "color": color,
        "backgroundColor": bg_color,
        "position": position,
        "maxWidth": max_width,
        "paddingX": padding_x,
        "paddingY": int(font_size * 0.3),
        "lineHeight": round(font_size * 1.4),
    }


def get_sizing_context_for_prompt(canvas_width: int, canvas_height: int) -> str:
    """Return a human-readable string the AI can include in planning prompts
    so it knows what font sizes to assign to text overlays."""
    aspect = get_aspect_category(canvas_width, canvas_height)

    sizes = {role: calculate_font_size(canvas_width, canvas_height, role=role) for role in FONT_SIZE_PRESETS}

    return (
        f"Canvas: {canvas_width}x{canvas_height} ({aspect})\n"
        f"Recommended font sizes (px):\n"
        f"  title:     {sizes['title']}\n"
        f"  heading:   {sizes['heading']}\n"
        f"  subtitle:  {sizes['subtitle']}\n"
        f"  body:      {sizes['body']}\n"
        f"  caption:   {sizes['caption']}\n"
        f"  small:     {sizes['small']}\n"
        f"  watermark: {sizes['watermark']}\n"
        f"Use these values for text_overlays[].size / fontSize. "
        f"Do NOT hardcode 48 — always pick a size from the list above based on the text role."
    )
