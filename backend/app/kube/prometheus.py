import json
import logging
from typing import Any

import niquests
from kubernetes import client
from kubernetes.client.exceptions import ApiException

from app.config import get_settings
from app.kube.manager import KubeManager

logger = logging.getLogger(__name__)

PROMETHEUS_SERVICE_NAMES = [
    "prometheus-server",
    "prometheus-operated",
    "prometheus-kube-prometheus-prometheus",
    "kube-prometheus-stack-prometheus",
    "prometheus",
]

PROMETHEUS_NAMESPACES = [
    "monitoring",
    "prometheus",
    "kube-system",
    "observability",
    "default",
]

_cached_url: str | None = None


def _discover_prometheus_service(api_client: client.ApiClient) -> str | None:
    for ns in PROMETHEUS_NAMESPACES:
        try:
            response = api_client.call_api(
                f"/api/v1/namespaces/{ns}/services",
                "GET",
                query_params=[],
                response_type="object",
                auth_settings=["BearerToken"],
                _preload_content=False,
            )
            data = json.loads(response[0].read())
            for svc in data.get("items", []):
                svc_name = svc.get("metadata", {}).get("name", "")
                if svc_name in PROMETHEUS_SERVICE_NAMES:
                    ports = svc.get("spec", {}).get("ports", [])
                    port = 9090
                    for p in ports:
                        if p.get("name") in ("http", "web", "http-web") or p.get("port") == 9090:
                            port = p["port"]
                            break
                    if ports and port == 9090:
                        port = ports[0].get("port", 9090)
                    url = f"http://{svc_name}.{ns}.svc.cluster.local:{port}"
                    logger.info("Discovered Prometheus at %s", url)
                    return url
        except ApiException:
            continue
        except Exception:
            logger.debug("Error listing services in %s", ns, exc_info=True)
            continue
    return None


def get_prometheus_url() -> str | None:
    global _cached_url

    settings = get_settings()
    if settings.prometheus_url:
        return settings.prometheus_url

    if _cached_url:
        return _cached_url

    try:
        api_client = KubeManager.get_instance().get_api_client()
        url = _discover_prometheus_service(api_client)
        if url:
            _cached_url = url
        return url
    except Exception:
        logger.debug("Failed to discover Prometheus", exc_info=True)
        return None


def reset_prometheus_cache() -> None:
    global _cached_url
    _cached_url = None


async def check_prometheus(url: str) -> bool:
    try:
        async with niquests.AsyncSession() as s:
            resp = await s.get(f"{url}/api/v1/status/buildinfo", timeout=5)
            return resp.status_code == 200
    except Exception:
        return False


async def query_range(
    url: str,
    query: str,
    start: float,
    end: float,
    step: str,
) -> dict[str, Any]:
    async with niquests.AsyncSession() as s:
        resp = await s.get(
            f"{url}/api/v1/query_range",
            params={"query": query, "start": start, "end": end, "step": step},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()


async def query_instant(url: str, query: str) -> dict[str, Any]:
    async with niquests.AsyncSession() as s:
        resp = await s.get(
            f"{url}/api/v1/query",
            params={"query": query},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()
