"""
Pipeline Metrics — Tracks costs, generation time, failure rates, and quality
scores across the movie pipeline. Feeds into model selection.
"""

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class GenerationMetric:
    model: str
    duration_seconds: float
    success: bool
    cost_usd: float
    quality_score: float | None = None


class PipelineMetrics:
    """Collects and reports pipeline performance metrics."""

    def __init__(self):
        self._metrics: list[GenerationMetric] = []
        self._model_stats: dict[str, dict] = defaultdict(
            lambda: {"success": 0, "fail": 0, "total_time": 0.0, "total_cost": 0.0}
        )
        self._session_costs: dict[str, float] = {}

    def record_generation(
        self,
        model: str,
        duration_seconds: float,
        success: bool,
        cost_usd: float,
        session_id: str | None = None,
        quality_score: float | None = None,
    ) -> None:
        """Record a single generation attempt."""
        metric = GenerationMetric(
            model=model,
            duration_seconds=duration_seconds,
            success=success,
            cost_usd=cost_usd,
            quality_score=quality_score,
        )
        self._metrics.append(metric)

        stats = self._model_stats[model]
        if success:
            stats["success"] += 1
        else:
            stats["fail"] += 1
        stats["total_time"] += duration_seconds
        stats["total_cost"] += cost_usd

        if session_id:
            self._session_costs[session_id] = (
                self._session_costs.get(session_id, 0) + cost_usd
            )

    def get_model_stats(self) -> dict:
        """Return per-model statistics."""
        result = {}
        for model, stats in self._model_stats.items():
            total = stats["success"] + stats["fail"]
            result[model] = {
                "total_calls": total,
                "success_rate": stats["success"] / total if total > 0 else 0,
                "avg_time_seconds": stats["total_time"] / total if total > 0 else 0,
                "total_cost_usd": round(stats["total_cost"], 2),
            }
        return result

    def get_session_cost(self, session_id: str) -> float:
        """Get total cost for a specific session."""
        return self._session_costs.get(session_id, 0)

    def get_preferred_model(self, category: str) -> str | None:
        """Select the best model for a category based on success rate.

        Higher success rate = preferred. Tie-break by lower average time.
        """
        from app.services.ai_video.replicate_provider import MODEL_REGISTRY

        models = MODEL_REGISTRY.get(category, {})
        if not models:
            return None

        best_model = None
        best_score = -1.0

        for name, model_id in models.items():
            stats = self._model_stats.get(model_id)
            if not stats:
                continue

            total = stats["success"] + stats["fail"]
            if total < 3:
                continue

            success_rate = stats["success"] / total
            avg_time = stats["total_time"] / total
            score = success_rate - (avg_time / 1000)  # Penalize slow models slightly

            if score > best_score:
                best_score = score
                best_model = model_id

        return best_model

    def get_summary(self) -> dict:
        """Return full pipeline metrics summary."""
        return {
            "total_generations": len(self._metrics),
            "total_cost_usd": round(sum(m.cost_usd for m in self._metrics), 2),
            "model_stats": self.get_model_stats(),
            "active_sessions": len(self._session_costs),
        }


# Global singleton
metrics = PipelineMetrics()
