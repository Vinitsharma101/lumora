from .claude import ClaudeProvider
from .openai_provider import OpenAIProvider
from .gemini import GeminiProvider
from .types import AIProviderName, AIProvider


def get_provider(name: AIProviderName, api_key: str) -> AIProvider:
    match name:
        case "claude":
            return ClaudeProvider(api_key)
        case "openai":
            return OpenAIProvider(api_key)
        case "gemini":
            return GeminiProvider(api_key)
        case _:
            raise ValueError(f"Unknown AI provider: {name}")


def get_api_key_for_provider(
    name: AIProviderName,
    *,
    anthropic_key: str | None = None,
    openai_key: str | None = None,
    google_key: str | None = None,
) -> str | None:
    match name:
        case "claude":
            return anthropic_key
        case "openai":
            return openai_key
        case "gemini":
            return google_key
        case _:
            return None
