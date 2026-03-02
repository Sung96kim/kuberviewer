import base64
import logging
import os
import tempfile
import time

import yaml
from kubernetes import client, config
from kubernetes.client import ApiClient, Configuration

from app.config import get_settings
from app.kube.oidc import get_oidc_token_for_exec
from app.models import ContextInfo

logger = logging.getLogger(__name__)


class KubeManager:
    _instance: "KubeManager | None" = None

    def __init__(self) -> None:
        self._api_client: client.ApiClient | None = None
        self._token_expiry: float = 0
        self._contexts: list[dict] = []
        self._current_context: str = ""
        self._config_file: str | None = None
        self._raw_config: dict | None = None
        self._load_contexts()

    def _load_contexts(self, context: str | None = None) -> None:
        settings = get_settings()
        self._config_file = settings.kubeconfig_path
        contexts, active = config.list_kube_config_contexts(
            config_file=self._config_file
        )
        self._contexts = list(contexts) if contexts else []
        target = context or active["name"]
        self._current_context = target
        self._api_client = None

        config_path = os.path.expanduser(
            self._config_file or config.KUBE_CONFIG_DEFAULT_LOCATION
        )
        with open(config_path) as f:
            self._raw_config = yaml.safe_load(f)

    def _find_raw_user(self, user_name: str) -> dict | None:
        if not self._raw_config:
            return None
        for u in self._raw_config.get("users", []):
            if u["name"] == user_name:
                return u.get("user", {})
        return None

    def _find_raw_cluster(self, cluster_name: str) -> dict | None:
        if not self._raw_config:
            return None
        for c in self._raw_config.get("clusters", []):
            if c["name"] == cluster_name:
                return c.get("cluster", {})
        return None

    def _find_context_info(self, context_name: str) -> dict | None:
        if not self._raw_config:
            return None
        for ctx in self._raw_config.get("contexts", []):
            if ctx["name"] == context_name:
                return ctx.get("context", {})
        return None

    def _try_oidc_client(self) -> ApiClient | None:
        ctx_info = self._find_context_info(self._current_context)
        if not ctx_info:
            return None

        user_config = self._find_raw_user(ctx_info["user"])
        if not user_config or "exec" not in user_config:
            return None

        result = get_oidc_token_for_exec(user_config["exec"])
        if not result:
            return None

        token, expiry = result

        cluster_config = self._find_raw_cluster(ctx_info["cluster"])
        if not cluster_config:
            return None

        cfg = Configuration()
        cfg.host = cluster_config["server"]
        cfg.api_key["authorization"] = f"Bearer {token}"

        ca_data = cluster_config.get("certificate-authority-data")
        ca_file = cluster_config.get("certificate-authority")
        if ca_data:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".crt")
            tmp.write(base64.b64decode(ca_data))
            tmp.close()
            cfg.ssl_ca_cert = tmp.name
        elif ca_file:
            cfg.ssl_ca_cert = ca_file

        if cluster_config.get("insecure-skip-tls-verify"):
            cfg.verify_ssl = False

        self._token_expiry = expiry
        logger.info("Using OIDC token for context %s", self._current_context)
        return ApiClient(configuration=cfg)

    def _is_token_expired(self) -> bool:
        return self._token_expiry > 0 and time.time() > self._token_expiry - 30

    def _ensure_client(self) -> client.ApiClient:
        if self._api_client is not None and self._is_token_expired():
            logger.info("OIDC token expiring, refreshing client")
            self._api_client = None

        if self._api_client is None:
            oidc_client = self._try_oidc_client()
            if oidc_client:
                self._api_client = oidc_client
            else:
                self._api_client = config.new_client_from_config(
                    config_file=self._config_file, context=self._current_context
                )
        return self._api_client

    @classmethod
    def get_instance(cls) -> "KubeManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_contexts(self) -> list[ContextInfo]:
        return [
            ContextInfo(
                name=ctx["name"],
                cluster=ctx["context"]["cluster"],
                user=ctx["context"]["user"],
                namespace=ctx["context"].get("namespace"),
            )
            for ctx in self._contexts
        ]

    def get_current_context(self) -> str:
        return self._current_context

    def set_context(self, name: str) -> None:
        self._load_contexts(context=name)

    def get_api_client(self) -> client.ApiClient:
        return self._ensure_client()
