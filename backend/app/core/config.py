from functools import lru_cache
from pathlib import Path
from typing import Annotated
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_CORS_ALLOW_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


class Settings(BaseSettings):
    app_name: str = Field(default="Job Assistant API")
    api_version: str = Field(default="0.1.0")
    debug: bool = Field(default=False)
    host: str = Field(default="127.0.0.1")
    port: int = Field(default=8000)
    database_url: str = Field(default="sqlite:///./job_assistant.db")
    profile_path: Path | None = Field(default=None)
    api_key: SecretStr | None = Field(default=None)
    openai_api_key: SecretStr | None = Field(default=None)
    openai_model: str = Field(default="gpt-4.1-mini")
    openai_timeout_seconds: float = Field(default=45.0, gt=0)
    mock_extraction: bool = Field(default=False)
    mock_compensation: bool = Field(default=False)
    mock_extraction_delay_ms: int = Field(default=2000, ge=0)
    mock_compensation_delay_ms: int = Field(default=1500, ge=0)
    mock_compensation_mode: Literal["success", "skipped", "error"] = Field(default="success")
    cors_allow_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: list(DEFAULT_CORS_ALLOW_ORIGINS)
    )

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        env_prefix="JOB_ASSISTANT_",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def parse_cors_allow_origins(cls, value: object) -> list[str]:
        if value is None:
            return list(DEFAULT_CORS_ALLOW_ORIGINS)

        if isinstance(value, str):
            origins = [item.strip() for item in value.split(",") if item.strip()]
            return origins or list(DEFAULT_CORS_ALLOW_ORIGINS)

        if isinstance(value, list):
            origins = [item.strip() for item in value if isinstance(item, str) and item.strip()]
            return origins or list(DEFAULT_CORS_ALLOW_ORIGINS)

        raise TypeError("cors_allow_origins must be a comma-separated string or list of origins")


@lru_cache
def get_settings() -> Settings:
    return Settings()
