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


_PROBLEM_REASONS = {
    "CrashLoopBackOff",
    "ImagePullBackOff",
    "ErrImagePull",
    "CreateContainerConfigError",
    "OOMKilled",
}


def _get_container_issues(pod: dict[str, Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for cs in (pod.get("status") or {}).get("containerStatuses") or []:
        state = cs.get("state") or {}
        waiting = state.get("waiting") or {}
        terminated = state.get("terminated") or {}
        reason = waiting.get("reason") or terminated.get("reason") or ""
        if reason in _PROBLEM_REASONS:
            counts[reason] = counts.get(reason, 0) + 1
    return counts


def _count_pods(api_client: Any) -> dict[str, Any]:
    data = _kube_request(api_client, "/api/v1/pods")
    items = data.get("items", [])
    total = len(items)
    running = sum(
        1
        for p in items
        if (p.get("status") or {}).get("phase") == "Running"
    )
    failed = sum(
        1
        for p in items
        if (p.get("status") or {}).get("phase") == "Failed"
    )
    pending = sum(
        1
        for p in items
        if (p.get("status") or {}).get("phase") == "Pending"
    )
    issues: dict[str, int] = {}
    for p in items:
        for reason, count in _get_container_issues(p).items():
            issues[reason] = issues.get(reason, 0) + count
    return {
        "total": total,
        "running": running,
        "failed": failed,
        "pending": pending,
        "issues": issues,
    }


def _count_deployments(api_client: Any) -> dict[str, int]:
    data = _kube_request(api_client, "/apis/apps/v1/deployments")
    items = data.get("items", [])
    total = len(items)
    ready = sum(
        1
        for d in items
        if (d.get("status") or {}).get("readyReplicas", 0)
        == (d.get("spec") or {}).get("replicas", 0)
    )
    return {"total": total, "ready": ready}


def _count_namespaces(api_client: Any) -> int:
    data = _kube_request(api_client, "/api/v1/namespaces")
    return len(data.get("items", []))


def _count_services(api_client: Any) -> int:
    data = _kube_request(api_client, "/api/v1/services")
    return len(data.get("items", []))


@router.get("/health")
async def cluster_health() -> dict[str, Any]:
    api_client = KubeManager.get_instance().get_api_client()
    nodes, pods, deployments, namespaces, services = await asyncio.gather(
        asyncio.to_thread(_count_nodes, api_client),
        asyncio.to_thread(_count_pods, api_client),
        asyncio.to_thread(_count_deployments, api_client),
        asyncio.to_thread(_count_namespaces, api_client),
        asyncio.to_thread(_count_services, api_client),
    )
    return {
        "nodes": nodes,
        "pods": pods,
        "deployments": deployments,
        "namespaces": namespaces,
        "services": services,
    }
