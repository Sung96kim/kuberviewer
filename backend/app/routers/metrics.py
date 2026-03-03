import asyncio
from typing import Any

from fastapi import APIRouter

from app.kube.manager import KubeManager
from app.kube.metrics import get_node_metrics, get_node_metrics_by_name, get_pod_metrics

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("/nodes")
async def node_metrics() -> dict[str, Any]:
    api_client = KubeManager.get_instance().get_api_client()
    data = await asyncio.to_thread(get_node_metrics, api_client)
    if data is None:
        return {"available": False}
    return {"available": True, "items": data.get("items", [])}


@router.get("/nodes/{name}")
async def node_metrics_by_name(name: str) -> dict[str, Any]:
    api_client = KubeManager.get_instance().get_api_client()
    data = await asyncio.to_thread(get_node_metrics_by_name, api_client, name)
    if data is None:
        return {"available": False}
    return {"available": True, "usage": data.get("usage", {})}


@router.get("/pods")
async def pod_metrics(namespace: str | None = None) -> dict[str, Any]:
    api_client = KubeManager.get_instance().get_api_client()
    data = await asyncio.to_thread(get_pod_metrics, api_client, namespace)
    if data is None:
        return {"available": False}
    return {"available": True, "items": data.get("items", [])}
