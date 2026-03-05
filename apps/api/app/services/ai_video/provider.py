"""GPU compute provider abstraction layer.

All providers are cloud API-based — no local models or GPUs required.
Supports: Google Veo, Replicate, OpenAI Sora.
"""

from typing import Protocol


class GPUProvider(Protocol):
    """Interface for cloud GPU/AI compute providers."""

    async def submit_job(self, model: str, input_data: dict) -> str:
        """Submit a job and return provider-specific job ID."""
        ...

    async def get_status(self, job_id: str) -> dict:
        """Get job status: {status, progress, output, error}."""
        ...

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job."""
        ...
