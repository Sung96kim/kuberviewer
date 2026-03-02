import asyncio
from typing import Any

from app.kube.manager import KubeManager
from app.kube.resources import _kube_request
from app.models import ResourceDefinition, ResourceGroup

WORKLOAD_KINDS = frozenset([
    "Pod", "Deployment", "ReplicaSet", "StatefulSet",
    "DaemonSet", "Job", "CronJob", "ReplicationController",
])

NETWORKING_KINDS = frozenset([
    "Service", "Ingress", "Endpoints", "NetworkPolicy", "EndpointSlice",
])

STORAGE_KINDS = frozenset([
    "PersistentVolumeClaim", "PersistentVolume", "StorageClass",
])

CONFIG_KINDS = frozenset([
    "ConfigMap", "Secret", "ServiceAccount", "ResourceQuota", "LimitRange",
])

GROUP_ORDER = ["Workloads", "Networking", "Storage", "Config", "Custom Resources", "Other"]


def _get_group_label(resource: ResourceDefinition) -> str:
    if resource.kind in WORKLOAD_KINDS:
        return "Workloads"
    if resource.kind in NETWORKING_KINDS:
        return "Networking"
    if resource.kind in STORAGE_KINDS:
        return "Storage"
    if resource.kind in CONFIG_KINDS:
        return "Config"
    if resource.group and not resource.group.endswith(".k8s.io"):
        return "Custom Resources"
    return "Other"


def group_resources(resources: list[ResourceDefinition]) -> list[ResourceGroup]:
    groups: dict[str, list[ResourceDefinition]] = {}
    for resource in resources:
        label = _get_group_label(resource)
        groups.setdefault(label, []).append(resource)
    return [
        ResourceGroup(label=label, resources=groups[label])
        for label in GROUP_ORDER
        if label in groups
    ]


def _parse_resources(
    data: dict[str, Any], group: str, version: str
) -> list[ResourceDefinition]:
    result: list[ResourceDefinition] = []
    for r in data.get("resources", []):
        if "/" in r["name"]:
            continue
        result.append(
            ResourceDefinition(
                group=group,
                version=version,
                kind=r["kind"],
                name=r["name"],
                singular_name=r.get("singularName", ""),
                namespaced=r["namespaced"],
                verbs=r.get("verbs", []),
                short_names=r.get("shortNames", []),
                categories=r.get("categories", []),
            )
        )
    return result


async def _fetch_group_resources(
    group_name: str, group_version: str, version: str
) -> list[ResourceDefinition]:
    api_client = KubeManager.get_instance().get_api_client()
    try:
        data = await asyncio.to_thread(
            _kube_request, api_client, f"/apis/{group_version}"
        )
        return _parse_resources(data, group_name, version)
    except Exception:
        return []


async def discover_apis() -> list[ResourceDefinition]:
    api_client = KubeManager.get_instance().get_api_client()

    core_data = await asyncio.to_thread(_kube_request, api_client, "/api/v1")
    resources = _parse_resources(core_data, "", "v1")

    groups_data = await asyncio.to_thread(_kube_request, api_client, "/apis")
    tasks = [
        _fetch_group_resources(
            g["name"],
            g["preferredVersion"]["groupVersion"],
            g["preferredVersion"]["version"],
        )
        for g in groups_data.get("groups", [])
    ]

    group_results = await asyncio.gather(*tasks)
    for result in group_results:
        resources.extend(result)

    return resources
