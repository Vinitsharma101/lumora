from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres.your-ref:your-password@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

    # Auth
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24 * 7  # 1 week

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # AI Providers
    ANTHROPIC_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    GOOGLE_AI_API_KEY: str | None = None

    # External AI Services
    ELEVENLABS_API_KEY: str | None = None
    PEXELS_API_KEY: str | None = None
    PIXABAY_API_KEY: str | None = None

    # Supabase
    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_KEY: str | None = None
    SUPABASE_ANON_KEY: str | None = None

    # Google Cloud AI (API-based, no local models)
    GOOGLE_CLOUD_PROJECT: str | None = None
    GOOGLE_CLOUD_LOCATION: str = "us-central1"

    # Replicate (API-based AI models)
    REPLICATE_API_TOKEN: str | None = None

    # Pinecone (character consistency vector embeddings)
    PINECONE_API_KEY: str | None = None
    PINECONE_ENVIRONMENT: str = "us-east-1-aws"

    # OpenAI Sora (video generation)
    # Uses the same OPENAI_API_KEY above

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
