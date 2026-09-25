"""Configurações e variáveis de ambiente do Laya Service."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    port: int = 8001
    laya_api_key: str = ""
    laya_model: str = "convaiinnovations/laya"
    laya_device: str = "cpu"
    laya_auto_threshold: float = 0.90
    laya_audit_threshold: float = 0.70
    log_level: str = "INFO"
    rate_limit_per_minute: int = 1200
    max_payload_bytes: int = 65536

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
