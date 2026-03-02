from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    kubeconfig_path: str | None = None
    cors_origins: list[str] = ["http://localhost:5173"]
    log_level: str = "info"

    model_config = {"env_prefix": "KUBERVIEWER_"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
