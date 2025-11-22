"""Configuration management for DeepAgent."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import AnyUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    deepseek_api_key: SecretStr = Field(..., description="API key for DeepSeek LLM.")
    deepseek_api_base: AnyUrl = Field(
        "https://api.deepseek.com", description="Base URL for the DeepSeek API."
    )
    deepseek_model: str = Field(
        "deepseek-chat",
        description="DeepSeek model identifier compatible with the ChatCompletions API.",
    )
    deepseek_temperature: float = Field(
        0.2,
        ge=0.0,
        le=2.0,
        description="Sampling temperature for DeepSeek completions.",
    )
    deepseek_max_output_tokens: Optional[int] = Field(
        None,
        ge=1,
        description="Optional cap on the number of output tokens from DeepSeek.",
    )

    flux_api_key: SecretStr = Field(..., description="API key for the FLUX outfitting service.")
    flux_api_url: AnyUrl = Field(
        ...,
        description="Endpoint URL that accepts model & garment images and returns the composed output.",
    )
    flux_timeout_seconds: float = Field(
        120.0,
        gt=0,
        description="HTTP timeout used when calling the FLUX API.",
    )

    output_dir: Path = Field(
        Path("outputs"), description="Directory where generated outfit images are stored."
    )

    model_config = SettingsConfigDict(
        env_prefix="DEEPAGENT_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    def ensure_output_dir(self) -> Path:
        """Make sure the output directory exists and return it."""
        output_path = self.output_dir
        output_path.mkdir(parents=True, exist_ok=True)
        return output_path

