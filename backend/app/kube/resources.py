import asyncio
import json
from typing import Any

from kubernetes import client

from app.kube.manager import KubeManager


def build_resource_url(
    group: str,
    version: str,
    name: str,
    namespaced: bool,
    namespace: str | None = None,
    resource_name: str | None = None,
) -> str:
    base = f"/apis/{group}/{version}" if group else f"/api/{version}"
    ns_part = f"/namespaces/{namespace}" if namespaced and namespace else ""
    res_part = f"/{resource_name}" if resource_name else ""
    return f"{base}{ns_part}/{name}{res_part}"


def _kube_request(
    api_client: client.ApiClient,
    path: str,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    query_params: list[tuple[str, str]] | None = None,
) -> dict[str, Any]:
    response = api_client.call_api(
        path,
        method,
        query_params=query_params or [],
        body=body,
        response_type="object",
        auth_settings=["BearerToken"],
        _preload_content=False,
    )
    data = response[0].read()
    return json.loads(data)


async def list_resources(
    group: str,
    version: str,
    name: str,
    namespaced: bool,
    namespace: str | None = None,
    label_selector: str | None = None,
    field_selector: str | None = None,
    limit: int | None = None,
    continue_token: str | None = None,
) -> dict[str, Any]:
    api_client = KubeManager.get_instance().get_api_client()
    path = build_resource_url(group, version, name, namespaced, namespace)
    query_params: list[tuple[str, str]] = []
    if label_selector:
        query_params.append(("labelSelector", label_selector))
    if field_selector:
        query_params.append(("fieldSelector", field_selector))
    if limit:
        query_params.append(("limit", str(limit)))
    if continue_token:
        query_params.append(("continue", continue_token))
    return await asyncio.to_thread(
        _kube_request, api_client, path, "GET", query_params=query_params
    )


async def get_resource(
    group: str,
    version: str,
    name: str,
    namespaced: bool,
    namespace: str | None = None,
    resource_name: str | None = None,
) -> dict[str, Any]:
    api_client = KubeManager.get_instance().get_api_client()
    path = build_resource_url(group, version, name, namespaced, namespace, resource_name)
    return await asyncio.to_thread(_kube_request, api_client, path, "GET")


async def delete_resource(
    group: str,
    version: str,
    name: str,
    namespaced: bool,
    namespace: str | None = None,
    resource_name: str | None = None,
) -> dict[str, Any]:
    api_client = KubeManager.get_instance().get_api_client()
    path = build_resource_url(group, version, name, namespaced, namespace, resource_name)
    return await asyncio.to_thread(_kube_request, api_client, path, "DELETE")


async def apply_resource(
    group: str,
    version: str,
    name: str,
    namespaced: bool,
    body: dict[str, Any],
    namespace: str | None = None,
    resource_name: str | None = None,
) -> dict[str, Any]:
    api_client = KubeManager.get_instance().get_api_client()
    path = build_resource_url(group, version, name, namespaced, namespace, resource_name)
    method = "PUT" if resource_name else "POST"
    return await asyncio.to_thread(_kube_request, api_client, path, method, body=body)
