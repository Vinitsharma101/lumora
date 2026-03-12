"""
Style Profiles — Professional editing presets by content type.

Each profile encodes the editorial brain of a professional editor:
pacing rules, audio levels, caption behavior, motion strategy, and
B-roll insertion logic. The DirectorAgent selects a profile based on
the user query, and every downstream agent reads it to make decisions.

Based on industry-standard practices from Adobe Premiere, Final Cut Pro,
and professional post-production workflows.
"""

from dataclasses import dataclass, field


# ── Track Layer Architecture ────────────────────────────────────────
# V3  Graphics / Effects
# V2  B-roll / Overlay
# V1  Main Footage
# A3  Music
# A2  SFX
# A1  Dialogue
TRACK_LAYERS = {
    "V1_MAIN": "video",
    "V2_BROLL": "overlay",
    "V3_GFX": "effects",
    "A1_DIALOG": "audio",
    "A2_SFX": "effects",
    "A3_MUSIC": "music",
}


@dataclass
class PacingProfile:
    """Controls cut timing and rhythm."""

    # Average clip durations (seconds) by shot type
    clip_duration_talking_head: tuple[float, float] = (4.0, 8.0)
    clip_duration_broll: tuple[float, float] = (3.0, 6.0)
    clip_duration_action: tuple[float, float] = (0.8, 2.0)

    # Cuts-per-minute target range
    cuts_per_minute: tuple[float, float] = (6.0, 12.0)

    # Silence handling
    max_silence_before_trim: float = 0.4  # seconds
    min_pause_between_cuts: float = 0.1  # seconds (breathing room)

    # Tension multipliers: applied to base duration
    high_tension_multiplier: float = 0.75  # shorter clips when tense
    low_tension_multiplier: float = 1.15  # longer clips when calm

    # Transition preferences (probability weights)
    transition_palette: dict = field(default_factory=lambda: {
        "cut": 0.7,
        "dissolve": 0.15,
        "fade": 0.1,
        "wipe": 0.05,
    })


@dataclass
class AudioProfile:
    """Professional audio mixing levels."""

    # Target LUFS for each layer
    dialog_lufs: float = -16.0
    music_under_speech_lufs: float = -24.0  # ducked
    music_no_speech_lufs: float = -14.0  # full
    sfx_lufs: float = -18.0
    ambient_lufs: float = -28.0

    # Ducking behavior
    duck_attack_ms: float = 50.0  # how fast music ducks
    duck_release_ms: float = 300.0  # how fast music recovers
    duck_hold_ms: float = 200.0  # hold ducked level after speech ends
    duck_depth_db: float = -8.0  # how much to duck

    # Dialog processing
    dialog_compressor_ratio: float = 3.0
    dialog_compressor_threshold_db: float = -18.0
    dialog_peak_db: float = -6.0

    # Volume presets (0-1 scale for timeline)
    volume_dialog: float = 1.0
    volume_music: float = 0.3
    volume_sfx: float = 0.7
    volume_ambient: float = 0.4

    # Fade durations for audio transitions
    music_fade_in_sec: float = 2.0
    music_fade_out_sec: float = 3.0
    sfx_fade_in_sec: float = 0.05
    sfx_fade_out_sec: float = 0.15


@dataclass
class CaptionProfile:
    """Caption timing and styling rules."""

    enabled: bool = True
    style: str = "default"  # default, viral, karaoke, minimal

    # Timing rules
    max_words_per_chunk: int = 5  # 3-5 words per line
    max_lines: int = 2
    min_duration_sec: float = 0.8
    max_duration_sec: float = 3.0
    delay_after_speech_start: float = 0.1  # seconds
    persist_until_sentence_end: bool = True

    # Animation
    word_by_word: bool = False  # kinetic word-by-word reveal
    highlight_keywords: bool = False
    emphasis_scale: float = 1.15  # scale factor for emphasized words
    animation_type: str = "fade_in"  # fade_in, pop, slide_up, typewriter


@dataclass
class MotionProfile:
    """Camera motion and zoom behavior."""

    # Ken Burns defaults
    ken_burns_zoom_range: tuple[float, float] = (1.0, 1.05)  # 3-5% zoom
    ken_burns_duration_sec: tuple[float, float] = (3.0, 6.0)

    # Punch zoom on emphasis
    punch_zoom_scale: float = 1.05  # 105% scale
    punch_zoom_duration_sec: float = 0.3
    punch_zoom_on_keywords: bool = True

    # Speed ramps
    speed_ramp_enabled: bool = False
    speed_ramp_slow: float = 0.5  # 50% speed for slow-mo
    speed_ramp_fast: float = 1.5  # 150% for speed-up

    # Subtle drift for static shots
    static_drift_enabled: bool = True
    static_drift_pixels_per_sec: float = 2.0


@dataclass
class BRollProfile:
    """B-roll insertion intelligence."""

    enabled: bool = True

    # When to insert B-roll
    insert_on_keywords: bool = True  # concept words trigger B-roll
    insert_on_pauses: bool = True  # 0.3-0.8s pauses
    insert_on_visual_fatigue: bool = True  # after N seconds of same shot

    # Visual fatigue threshold (seconds of same shot before B-roll)
    fatigue_threshold_sec: float = 6.0

    # B-roll timing
    min_broll_duration: float = 1.5
    max_broll_duration: float = 4.0
    fade_in_frames: int = 6  # 4-8 frames
    fade_out_frames: int = 6

    # Overlay behavior
    zoom_percent: float = 3.0  # subtle 2-4% zoom on B-roll
    opacity: float = 1.0


@dataclass
class StyleProfile:
    """Complete editing style profile for a content type."""

    name: str
    description: str
    pacing: PacingProfile
    audio: AudioProfile
    captions: CaptionProfile
    motion: MotionProfile
    broll: BRollProfile

    # Content metadata
    target_aspect_ratio: str = "16:9"  # 16:9, 9:16, 1:1
    target_fps: int = 24

    def to_dict(self) -> dict:
        """Serialize for storage in agent state."""
        import dataclasses
        return {
            "name": self.name,
            "description": self.description,
            "target_aspect_ratio": self.target_aspect_ratio,
            "target_fps": self.target_fps,
            "pacing": dataclasses.asdict(self.pacing),
            "audio": dataclasses.asdict(self.audio),
            "captions": dataclasses.asdict(self.captions),
            "motion": dataclasses.asdict(self.motion),
            "broll": dataclasses.asdict(self.broll),
        }


# ── Predefined Style Profiles ──────────────────────────────────────

STYLE_PROFILES: dict[str, StyleProfile] = {
    "reel": StyleProfile(
        name="reel",
        description="Short-form social (TikTok, Reels, Shorts). High energy, fast cuts, kinetic captions.",
        target_aspect_ratio="9:16",
        target_fps=30,
        pacing=PacingProfile(
            clip_duration_talking_head=(1.5, 3.0),
            clip_duration_broll=(1.2, 2.5),
            clip_duration_action=(0.8, 1.5),
            cuts_per_minute=(15.0, 30.0),
            max_silence_before_trim=0.25,
            high_tension_multiplier=0.7,
            low_tension_multiplier=1.0,
            transition_palette={"cut": 0.85, "zoom": 0.1, "glitch": 0.05},
        ),
        audio=AudioProfile(
            music_under_speech_lufs=-22.0,
            music_no_speech_lufs=-12.0,
            volume_music=0.4,
            volume_sfx=0.8,
            music_fade_in_sec=0.5,
            music_fade_out_sec=1.0,
        ),
        captions=CaptionProfile(
            style="viral",
            max_words_per_chunk=3,
            max_lines=1,
            min_duration_sec=0.5,
            max_duration_sec=1.5,
            word_by_word=True,
            highlight_keywords=True,
            emphasis_scale=1.25,
            animation_type="pop",
        ),
        motion=MotionProfile(
            ken_burns_zoom_range=(1.0, 1.08),
            punch_zoom_scale=1.08,
            punch_zoom_duration_sec=0.2,
            speed_ramp_enabled=True,
            speed_ramp_slow=0.6,
            speed_ramp_fast=2.0,
        ),
        broll=BRollProfile(
            fatigue_threshold_sec=3.0,
            min_broll_duration=1.0,
            max_broll_duration=2.5,
            fade_in_frames=4,
            zoom_percent=5.0,
        ),
    ),

    "youtube": StyleProfile(
        name="youtube",
        description="Long-form YouTube content. Balanced pacing, clear captions, B-roll engagement.",
        pacing=PacingProfile(
            clip_duration_talking_head=(4.0, 8.0),
            clip_duration_broll=(3.0, 6.0),
            clip_duration_action=(1.5, 3.0),
            cuts_per_minute=(8.0, 15.0),
            max_silence_before_trim=0.4,
            transition_palette={"cut": 0.75, "dissolve": 0.1, "fade": 0.1, "zoom": 0.05},
        ),
        audio=AudioProfile(),  # defaults are YouTube-optimized
        captions=CaptionProfile(
            style="default",
            max_words_per_chunk=5,
            highlight_keywords=True,
            animation_type="fade_in",
        ),
        motion=MotionProfile(
            ken_burns_zoom_range=(1.0, 1.04),
            punch_zoom_scale=1.05,
            punch_zoom_on_keywords=True,
        ),
        broll=BRollProfile(
            fatigue_threshold_sec=6.0,
            min_broll_duration=2.0,
            max_broll_duration=4.0,
        ),
    ),

    "podcast": StyleProfile(
        name="podcast",
        description="Podcast/interview format. Slow pacing, minimal effects, speech priority.",
        pacing=PacingProfile(
            clip_duration_talking_head=(8.0, 15.0),
            clip_duration_broll=(4.0, 8.0),
            clip_duration_action=(3.0, 6.0),
            cuts_per_minute=(3.0, 6.0),
            max_silence_before_trim=0.8,
            high_tension_multiplier=0.9,
            low_tension_multiplier=1.2,
            transition_palette={"cut": 0.85, "dissolve": 0.1, "fade": 0.05},
        ),
        audio=AudioProfile(
            dialog_lufs=-14.0,
            music_under_speech_lufs=-28.0,
            music_no_speech_lufs=-18.0,
            volume_music=0.15,
            volume_ambient=0.2,
        ),
        captions=CaptionProfile(
            style="minimal",
            max_words_per_chunk=6,
            word_by_word=False,
            highlight_keywords=False,
            animation_type="fade_in",
        ),
        motion=MotionProfile(
            ken_burns_zoom_range=(1.0, 1.02),
            punch_zoom_on_keywords=False,
            static_drift_pixels_per_sec=1.0,
        ),
        broll=BRollProfile(
            enabled=False,
        ),
    ),

    "documentary": StyleProfile(
        name="documentary",
        description="Documentary/narrative. Cinematic pacing, atmospheric audio, thoughtful transitions.",
        target_fps=24,
        pacing=PacingProfile(
            clip_duration_talking_head=(5.0, 12.0),
            clip_duration_broll=(3.0, 8.0),
            clip_duration_action=(2.0, 5.0),
            cuts_per_minute=(4.0, 8.0),
            max_silence_before_trim=0.6,
            high_tension_multiplier=0.8,
            low_tension_multiplier=1.2,
            transition_palette={"cut": 0.5, "dissolve": 0.25, "fade": 0.2, "wipe": 0.05},
        ),
        audio=AudioProfile(
            music_under_speech_lufs=-22.0,
            music_no_speech_lufs=-14.0,
            volume_music=0.35,
            volume_ambient=0.5,
            music_fade_in_sec=3.0,
            music_fade_out_sec=4.0,
        ),
        captions=CaptionProfile(
            style="minimal",
            max_words_per_chunk=6,
            max_lines=2,
            animation_type="fade_in",
        ),
        motion=MotionProfile(
            ken_burns_zoom_range=(1.0, 1.05),
            ken_burns_duration_sec=(4.0, 8.0),
            punch_zoom_on_keywords=False,
            speed_ramp_enabled=True,
            speed_ramp_slow=0.7,
        ),
        broll=BRollProfile(
            fatigue_threshold_sec=8.0,
            min_broll_duration=3.0,
            max_broll_duration=6.0,
            fade_in_frames=8,
            zoom_percent=2.0,
        ),
    ),

    "corporate": StyleProfile(
        name="corporate",
        description="Corporate/presentation. Clean, professional, minimal effects.",
        pacing=PacingProfile(
            clip_duration_talking_head=(5.0, 10.0),
            clip_duration_broll=(3.0, 5.0),
            clip_duration_action=(2.0, 4.0),
            cuts_per_minute=(5.0, 10.0),
            max_silence_before_trim=0.5,
            transition_palette={"cut": 0.6, "dissolve": 0.2, "fade": 0.15, "wipe": 0.05},
        ),
        audio=AudioProfile(
            volume_music=0.2,
            volume_sfx=0.5,
            music_under_speech_lufs=-26.0,
        ),
        captions=CaptionProfile(
            style="default",
            max_words_per_chunk=5,
            word_by_word=False,
            highlight_keywords=False,
        ),
        motion=MotionProfile(
            ken_burns_zoom_range=(1.0, 1.03),
            punch_zoom_on_keywords=False,
            speed_ramp_enabled=False,
            static_drift_pixels_per_sec=1.5,
        ),
        broll=BRollProfile(
            fatigue_threshold_sec=7.0,
            min_broll_duration=2.0,
            max_broll_duration=4.0,
            zoom_percent=2.0,
        ),
    ),

    "cinematic": StyleProfile(
        name="cinematic",
        description="Cinematic/film. Dramatic pacing, rich color, bold transitions.",
        target_fps=24,
        pacing=PacingProfile(
            clip_duration_talking_head=(4.0, 8.0),
            clip_duration_broll=(3.0, 6.0),
            clip_duration_action=(1.0, 3.0),
            cuts_per_minute=(6.0, 12.0),
            high_tension_multiplier=0.7,
            low_tension_multiplier=1.15,
            transition_palette={"cut": 0.55, "dissolve": 0.2, "fade": 0.15, "wipe": 0.05, "zoom": 0.05},
        ),
        audio=AudioProfile(
            music_under_speech_lufs=-20.0,
            music_no_speech_lufs=-12.0,
            volume_music=0.4,
            volume_ambient=0.5,
            duck_depth_db=-10.0,
        ),
        captions=CaptionProfile(
            enabled=False,
        ),
        motion=MotionProfile(
            ken_burns_zoom_range=(1.0, 1.06),
            punch_zoom_scale=1.06,
            speed_ramp_enabled=True,
            speed_ramp_slow=0.5,
            speed_ramp_fast=1.5,
        ),
        broll=BRollProfile(
            fatigue_threshold_sec=5.0,
            min_broll_duration=2.0,
            max_broll_duration=5.0,
            fade_in_frames=6,
            zoom_percent=3.0,
        ),
    ),
}

# Default profile when content type is unknown
DEFAULT_PROFILE = "youtube"


def get_style_profile(content_type: str) -> StyleProfile:
    """Get a style profile by name. Falls back to YouTube if unknown."""
    return STYLE_PROFILES.get(content_type, STYLE_PROFILES[DEFAULT_PROFILE])


def get_all_profile_names() -> list[str]:
    """Return all available profile names for prompting."""
    return list(STYLE_PROFILES.keys())


def get_profile_summary() -> str:
    """Return a human-readable summary of all profiles for LLM prompting."""
    lines = []
    for name, profile in STYLE_PROFILES.items():
        cuts = profile.pacing.cuts_per_minute
        lines.append(
            f"- {name}: {profile.description} "
            f"(cuts/min: {cuts[0]}-{cuts[1]}, "
            f"aspect: {profile.target_aspect_ratio}, "
            f"fps: {profile.target_fps})"
        )
    return "\n".join(lines)
