"""Application configuration using Pydantic Settings."""

import json
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # Application settings
    APP_NAME: str = "UK Wind Forecast Analysis API"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # Elexon BMRS API Endpoints
    ELEXON_API_BASE_URL: str = "https://data.elexon.co.uk/bmrs/api/v1"
    FUELHH_STREAM_URL: str = "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream"
    WINDFOR_STREAM_URL: str = "https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream"

    # Default Procurement Analysis Window (January 2026 Scope)
    DEFAULT_START_DATE: str = "2026-01-01"
    DEFAULT_END_DATE: str = "2026-01-31"

    # Default Day-Ahead wholesale decision cutoff hour (UTC)
    # E.g., 12 means day-ahead at 12:00:00 UTC (12:00 gate closure)
    DEFAULT_DAY_AHEAD_CUTOFF_HOUR: int = 12

    # HTTP Resilience Settings
    HTTP_TIMEOUT_SECONDS: float = 30.0
    MAX_RETRIES: int = 3
    RETRY_BACKOFF_FACTOR: float = 0.5

    # CORS Configuration
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Parse CORS origins whether provided as a JSON string, comma-separated string, or list."""
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
