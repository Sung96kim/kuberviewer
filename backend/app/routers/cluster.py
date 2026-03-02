import asyncio
from typing import Any

from fastapi import APIRouter

from app.kube.manager import KubeManager
from app.kube.resources import _kube_request

router = APIRouter(prefix="/api/cluster", tags=["cluster"])


def _count_nodes(api_client: Any) -> dict[str, int]:
    data = _kube_request(api_client, "/api/v1/nodes")
    items = data.get("items", [])
    total = len(items)
    ready = 0
    for node in items:
        conditions = (node.get("status") or {}).get("conditions") or []
        for c in conditions:
            if c.get("type") == "Ready" and c.get("status") == "True":
                ready += 1
                break
    return {"total": total, "ready": ready}


def _count_pods(api_client: Any) -> dict[str, int]:
    data = _kube_request(api_client, "/api/v1/pods")
    items = data.get("items", [])
    total = len(items)
    running = sum(
        1
        for p in items
        if (p.get("status") or {}).get("phase") == "Running"
    )
    return {"total": total, "running": running}


@router.get("/health")
async def cluster_health() -> dict[str, Any]:
    api_client = KubeManager.get_instance().get_api_client()
    nodes, pods = await asyncio.gather(
        asyncio.to_thread(_count_nodes, api_client),
        asyncio.to_thread(_count_pods, api_client),
    )
    return {"nodes": nodes, "pods": pods}
