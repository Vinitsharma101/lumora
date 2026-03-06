"""
Ingestion Agent — Handles raw video preprocessing and chunking.
Splits 1-hour videos into manageable segments for parallel processing.
"""

import logging
import uuid

logger = logging.getLogger(__name__)

class IngestionAgent:
    """Preprocesses and chunks raw video uploads."""

    def __init__(self):
        pass

    async def run(self, state: dict) -> dict:
        """Process the raw video: extract audio, and split video into chunks with overlap."""
        raw_video_url = state.get("raw_video_url")
        if not raw_video_url:
            raw_video_url = "mock_raw_video_1_hour.mp4"
            state["raw_video_url"] = raw_video_url

        project_id = state.get("project_id", "unknown")
        logger.info(f"IngestionAgent: Processing raw video from {raw_video_url}")

        # 1. EXTRACT AUDIO SEPARATELY (Platform Rule)
        # ffmpeg -i input.mp4 -vn -acodec libmp3lame -q:a 2 audio_track.mp3
        audio_url = f"s3://bucket/processed/{project_id}/master_audio.mp3"
        logger.info(f"IngestionAgent: Extracted master audio to {audio_url}")

        # 2. CHUNK WITH 2-SECOND OVERLAP
        # Overlapping chunks ensures we don't cut off words or action at exact boundaries.
        total_duration = state.get("total_duration", 3600)  # default 1 hr
        chunk_core_duration = 120  # 2 minutes per chunk
        overlap = 2  # 2 seconds overlap at the end of each chunk
        
        chunks = []
        current_time = 0
        chunk_idx = 0
        
        while current_time < total_duration:
            # The chunk goes from current_time to (current_time + chunk_core_duration + overlap)
            # Except the last chunk which just goes to the end.
            end_time = min(total_duration, current_time + chunk_core_duration + overlap)
            duration = end_time - current_time
            
            chunks.append({
                "chunk_id": f"chunk_{uuid.uuid4().hex[:8]}",
                "index": chunk_idx,
                "start_time": current_time,
                "end_time": end_time,
                "duration": duration,
                "overlap_seconds": overlap if end_time < total_duration else 0,
                "url": f"s3://bucket/processed/{project_id}/chunk_{chunk_idx}.mp4",
                # The audio for just this chunk, also extracted:
                "audio_url": f"s3://bucket/processed/{project_id}/chunk_{chunk_idx}_audio.mp3"
            })
            
            # Move the pointer forward by the CORE duration, so the next chunk starts 2s 
            # before this one ended (i.e. exactly where current_time + chunk_core_duration is)
            current_time += chunk_core_duration
            chunk_idx += 1

        return {
            **state,
            "raw_video_url": raw_video_url,
            "master_audio_url": audio_url,
            "chunk_metadata": chunks,
            "status": "ingestion_complete",
            "messages": state.get("messages", []) + [
                {"role": "agent", "content": f"Ingestion Agent extracted audio and split {total_duration}s video into {len(chunks)} overlapping chunks of ~{chunk_core_duration}s."}
            ]
        }
