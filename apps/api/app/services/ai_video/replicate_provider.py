"""Replicate API integration for AI video/image models.

Cloud API only — no local models. Supports:
- FLUX (text-to-image)
- Stable Video Diffusion (text-to-video, image-to-video)
- Real-ESRGAN (upscaling)
- RMBG (background removal)
- Style transfer models
- Lip sync / talking head models
- LLaVA (image understanding)
- Whisper (audio transcription)
- PhotoMaker / InstantID (character consistency)
- CogVideoX (long video)
- Wav2Lip (lip sync)
- MusicGen / Stable Audio (music)
- XTTS-v2 (voice cloning)
- Depth Anything v2 (depth estimation)
- FLUX Fill (inpainting)
- RIFE (frame interpolation)
"""

import asyncio
import logging

import replicate as replicate_sdk

from app.config import settings

logger = logging.getLogger(__name__)


def _normalize_result(status: str, output=None, error: str | None = None, **extra) -> dict:
    return {"status": status, "output": output or [], "error": error, **extra}

# ── Model Registry ────────────────────────────────────────────────────────────
MODEL_REGISTRY = {
    "text_to_image": {
        "flux-schnell": "black-forest-labs/flux-schnell",
        "flux-dev": "black-forest-labs/flux-dev",
        "sdxl": "stability-ai/sdxl:latest",
    },
    "text_to_video": {
        "minimax": "minimax/video-01",
        "wan-t2v": "wavespeedai/wan-2.1-t2v-480p",
        "svd": "stability-ai/stable-video-diffusion",
        "cogvideox": "fofr/cogvideox-5b",
        "luma": "luma/dream-machine",
    },
    "image_to_video": {
        "svd": "stability-ai/stable-video-diffusion",
        "wan-i2v": "wavespeedai/wan-2.1-i2v-480p",
        "luma": "luma/dream-machine",
    },
    "video_to_video": {
        "animate-diff": "lucataco/animate-diff",
        "animatediff-controlnet": "lucataco/animatediff-controlnet",
    },
    "upscale": {
        "real-esrgan": "nightmareai/real-esrgan:latest",
        "real-esrgan-video": "lucataco/real-esrgan-video",
    },
    "background_removal": {
        "rmbg": "cjwbw/rmbg:latest",
    },
    "image_understanding": {
        "llava": "yorickvp/llava-v1.6-mistral-7b:latest",
    },
    "audio_transcription": {
        "whisper": "openai/whisper:latest",
    },
    "character_consistency": {
        "photomaker": "tencentarc/photomaker",
        "instant-id": "zsxkib/instant-id",
    },
    "lip_sync": {
        "sadtalker": "cjwbw/sadtalker",
        "wav2lip": "devxpy/wav2lip",
    },
    "music": {
        "musicgen": "meta/musicgen",
        "stable-audio": "stability-ai/stable-audio-open-1.0",
    },
    "voice_clone": {
        "xtts-v2": "lucataco/xtts-v2",
    },
    "depth": {
        "depth-anything-v2": "cjwbw/depth-anything-v2",
    },
    "inpainting": {
        "flux-fill": "black-forest-labs/flux-fill-pro",
    },
    "frame_interpolation": {
        "rife": "pollinations/rife-interpolation",
    },
}

class ReplicateProvider:
    """Replicate.com cloud API for running ML models."""

    def __init__(self):
        if settings.REPLICATE_API_TOKEN:
            self.client = replicate_sdk.Client(api_token=settings.REPLICATE_API_TOKEN)
        else:
            self.client = None

    def _ensure_client(self):
        if not self.client:
            raise RuntimeError("REPLICATE_API_TOKEN not configured")

    def _ensure_allowed_model(self, model: str) -> str:
        allowed = {v for group in MODEL_REGISTRY.values() for v in group.values()}
        if model not in allowed:
            raise ValueError(f"Unsupported Replicate model: {model}")
        return model

    # ── Core: Run and Wait ──

    async def run_and_wait(
        self,
        model: str,
        input_data: dict,
        timeout: int = 600,
    ) -> dict:
        """Create a prediction, poll until complete, return output URL(s).

        This is the workhorse method — all generation methods should use it
        when they need to block until the result is ready.
        """
        self._ensure_client()
        model = self._ensure_allowed_model(model)

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model=model,
            input=input_data,
        )
        logger.info(f"Replicate prediction {prediction.id} created for {model}")

        result = await self.wait_for_prediction(prediction.id, timeout=timeout)

        if result["status"] == "succeeded":
            output = result["output"]
            # Normalize output to a URL string when possible
            if isinstance(output, list) and len(output) > 0:
                output_url = output[0] if isinstance(output[0], str) else str(output[0])
            elif isinstance(output, str):
                output_url = output
            else:
                output_url = None

            return _normalize_result("succeeded", output=output, provider="replicate", prediction_id=prediction.id, output_url=output_url)

        error = result.get("error") or f"Prediction ended with status: {result['status']}"
        raise RuntimeError(f"Replicate prediction {prediction.id} failed: {error}")

    # ── Text-to-Video ──

    async def text_to_video(self, prompt: str, duration: int = 4, wait: bool = False) -> dict:
        """Generate video from text using Stable Video Diffusion on Replicate."""
        self._ensure_client()
        model = "minimax/video-01"
        input_data = {"prompt": prompt, "num_frames": duration * 24}

        if wait:
            return await self.run_and_wait(model, input_data, timeout=600)

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model=model,
            input=input_data,
        )
        return _normalize_result(prediction.status, output=[], provider="replicate", prediction_id=prediction.id)

    # ── Luma Dream Machine (Text-to-Video) ──

    async def text_to_video_luma(self, prompt: str, aspect_ratio: str = "16:9", wait: bool = False) -> dict:
        """Generate video from text using Luma Dream Machine on Replicate."""
        self._ensure_client()
        model = MODEL_REGISTRY["text_to_video"]["luma"]
        input_data = {"prompt": prompt, "aspect_ratio": aspect_ratio}

        if wait:
            return await self.run_and_wait(model, input_data, timeout=600)

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model=model,
            input=input_data,
        )
        return _normalize_result(prediction.status, output=[], provider="replicate", prediction_id=prediction.id)

    # ── Luma Dream Machine (Image-to-Video) ──

    async def image_to_video_luma(self, image_url: str, prompt: str | None = None, aspect_ratio: str = "16:9", wait: bool = False) -> dict:
        """Animate an image using Luma Dream Machine on Replicate."""
        self._ensure_client()
        model = MODEL_REGISTRY["image_to_video"]["luma"]
        input_data: dict = {"start_image_url": image_url, "aspect_ratio": aspect_ratio}
        if prompt:
            input_data["prompt"] = prompt

        if wait:
            return await self.run_and_wait(model, input_data, timeout=600)

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model=model,
            input=input_data,
        )
        return _normalize_result(prediction.status, output=[], provider="replicate", prediction_id=prediction.id)

    # ── Image-to-Video ──

    async def image_to_video(self, image_url: str, prompt: str | None = None, wait: bool = False) -> dict:
        """Animate an image using Stable Video Diffusion."""
        self._ensure_client()
        model = "stability-ai/stable-video-diffusion"
        input_data = {"input_image": image_url, "prompt": prompt or ""}

        if wait:
            return await self.run_and_wait(model, input_data, timeout=600)

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model=model,
            input=input_data,
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Text-to-Image (FLUX) ──

    async def text_to_image(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        model: str = "schnell",
        wait: bool = False,
        negative_prompt: str | None = None,
        seed: int | None = None,
    ) -> dict:
        """Generate an image from text using FLUX models on Replicate."""
        self._ensure_client()

        model_id = (
            "black-forest-labs/flux-schnell"
            if model == "schnell"
            else "black-forest-labs/flux-dev"
        )
        input_data: dict = {"prompt": prompt, "width": width, "height": height, "num_outputs": 1}
        if negative_prompt:
            input_data["negative_prompt"] = negative_prompt
        if seed is not None:
            input_data["seed"] = seed

        if wait:
            return await self.run_and_wait(model_id, input_data, timeout=300)

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model=model_id,
            input=input_data,
        )
        return _normalize_result(prediction.status, output=[], provider="replicate", prediction_id=prediction.id, model=model_id)

    # ── Video-to-Video ──

    async def video_to_video(
        self,
        video_url: str,
        prompt: str,
        strength: float = 0.7,
    ) -> dict:
        """Transform a video using AI style transfer / video diffusion.

        Uses SDXL for frame-level style transformation.
        """
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="stability-ai/sdxl",
            input={
                "image": video_url,
                "prompt": prompt,
                "strength": strength,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Image Understanding (LLaVA) ──

    async def describe_image(
        self,
        image_url: str,
        question: str = "Describe this image in detail. Include the subject, composition, colors, mood, and any text visible.",
    ) -> dict:
        """Analyze and describe an image using LLaVA vision model."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="yorickvp/llava-v1.6-34b",
            input={
                "image": image_url,
                "prompt": question,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Video Understanding ──

    async def describe_video(
        self,
        video_url: str,
        question: str = "Describe this video in detail. What is happening, who are the subjects, what is the mood, and key visual elements?",
    ) -> dict:
        """Analyze and describe a video using a vision model.

        For video understanding, we use LLaVA with a keyframe extraction approach.
        The Replicate model handles video input as a sequence of frames.
        """
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="yorickvp/llava-v1.6-34b",
            input={
                "image": video_url,
                "prompt": question,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Upscaling ──

    async def upscale_image(self, image_url: str, scale: int = 2) -> dict:
        """Upscale an image using Real-ESRGAN."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="nightmareai/real-esrgan",
            input={
                "image": image_url,
                "scale": scale,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Background Removal ──

    async def remove_background(self, image_url: str) -> dict:
        """Remove background from an image using RMBG."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="cjwbw/rembg",
            input={"image": image_url},
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Style Transfer ──

    async def style_transfer(self, video_url: str, style_prompt: str, strength: float = 0.7) -> dict:
        """Apply AI style transfer to a video."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="stability-ai/sdxl",
            input={
                "prompt": style_prompt,
                "image": video_url,
                "strength": strength,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Talking Head ──

    async def talking_head(self, face_image_url: str, audio_url: str) -> dict:
        """Generate a talking head video from a face image and audio."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="cjwbw/sadtalker",
            input={
                "source_image": face_image_url,
                "driven_audio": audio_url,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Audio Transcription (Whisper) ──

    async def transcribe_audio(self, audio_url: str, language: str = "en") -> dict:
        """Transcribe audio using Whisper on Replicate (no local model)."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="openai/whisper",
            input={
                "audio": audio_url,
                "language": language,
                "model": "large-v3",
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Prediction Status ──

    async def get_prediction_status(self, prediction_id: str) -> dict:
        """Check status of a Replicate prediction."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.get, prediction_id
        )
        return {
            "status": prediction.status,  # starting, processing, succeeded, failed, canceled
            "output": prediction.output,
            "error": prediction.error,
            "logs": prediction.logs,
        }

    # ── Wait for prediction (synchronous polling) ──

    async def wait_for_prediction(self, prediction_id: str, timeout: int = 300) -> dict:
        """Poll a prediction until it completes or times out."""
        import time

        start = time.time()
        while time.time() - start < timeout:
            result = await self.get_prediction_status(prediction_id)
            if result["status"] in ("succeeded", "failed", "canceled"):
                return result
            await asyncio.sleep(2)

        return {"status": "timeout", "error": f"Prediction {prediction_id} timed out after {timeout}s"}

    # ── Phase 2: Character Consistency Models ──

    async def generate_with_face_reference(
        self,
        prompt: str,
        reference_image_url: str,
        style: str = "Photographic",
    ) -> dict:
        """Generate an image preserving the face from reference using PhotoMaker."""
        return await self.run_and_wait(
            "tencentarc/photomaker",
            {
                "prompt": f"img {prompt}",
                "input_image": reference_image_url,
                "style_name": style,
                "num_outputs": 1,
            },
            timeout=300,
        )

    async def generate_preserving_identity(
        self,
        prompt: str,
        face_image_url: str,
        pose_image_url: str | None = None,
    ) -> dict:
        """Generate an image preserving identity using InstantID."""
        input_data = {
            "prompt": prompt,
            "image": face_image_url,
            "num_outputs": 1,
        }
        if pose_image_url:
            input_data["pose_image"] = pose_image_url
        return await self.run_and_wait("zsxkib/instant-id", input_data, timeout=300)

    # ── Phase 2: Long Video ──

    async def generate_long_video(
        self,
        prompt: str,
        num_frames: int = 49,
    ) -> dict:
        """Generate longer video clips using CogVideoX-5B."""
        return await self.run_and_wait(
            "fofr/cogvideox-5b",
            {"prompt": prompt, "num_frames": num_frames},
            timeout=900,
        )

    # ── Phase 2: Lip Sync ──

    async def lip_sync(
        self,
        face_video_url: str,
        audio_url: str,
    ) -> dict:
        """Lip sync a face video to audio using Wav2Lip."""
        return await self.run_and_wait(
            "devxpy/wav2lip",
            {"face": face_video_url, "audio": audio_url},
            timeout=600,
        )

    # ── Phase 2: Music Generation ──

    async def generate_music(
        self,
        prompt: str,
        duration: int = 30,
    ) -> dict:
        """Generate music using MusicGen."""
        return await self.run_and_wait(
            "meta/musicgen",
            {"prompt": prompt, "duration": duration, "model_version": "stereo-melody-large"},
            timeout=300,
        )

    async def generate_music_v2(
        self,
        prompt: str,
        duration: float = 30.0,
    ) -> dict:
        """Generate music using Stable Audio Open."""
        return await self.run_and_wait(
            "stability-ai/stable-audio-open-1.0",
            {"prompt": prompt, "duration": duration},
            timeout=300,
        )

    # ── Phase 2: Voice Cloning ──

    async def clone_voice_and_speak(
        self,
        text: str,
        speaker_wav_url: str,
        language: str = "en",
    ) -> dict:
        """Clone a voice and generate speech using XTTS-v2."""
        return await self.run_and_wait(
            "lucataco/xtts-v2",
            {"text": text, "speaker_wav": speaker_wav_url, "language": language},
            timeout=300,
        )

    # ── Phase 2: Depth Estimation ──

    async def estimate_depth(self, image_url: str) -> dict:
        """Estimate depth map using Depth Anything v2."""
        return await self.run_and_wait(
            "cjwbw/depth-anything-v2",
            {"image": image_url},
            timeout=120,
        )

    # ── Phase 2: Inpainting ──

    async def inpaint(
        self,
        image_url: str,
        mask_url: str,
        prompt: str,
    ) -> dict:
        """Inpaint an image region using FLUX Fill."""
        return await self.run_and_wait(
            "black-forest-labs/flux-fill-pro",
            {"image": image_url, "mask": mask_url, "prompt": prompt},
            timeout=300,
        )

    # ── Phase 2/6: Frame Interpolation ──

    async def interpolate_frames(
        self,
        frame1_url: str,
        frame2_url: str,
        num_interpolations: int = 2,
    ) -> dict:
        """Interpolate between two frames using RIFE."""
        return await self.run_and_wait(
            "pollinations/rife-interpolation",
            {
                "frame1": frame1_url,
                "frame2": frame2_url,
                "num_interpolations": num_interpolations,
            },
            timeout=120,
        )

    # ── Phase 6: Video Upscaling ──

    async def upscale_video(self, video_url: str) -> dict:
        """Upscale video to higher resolution using Real-ESRGAN Video."""
        return await self.run_and_wait(
            "lucataco/real-esrgan-video",
            {"video_path": video_url},
            timeout=900,
        )
