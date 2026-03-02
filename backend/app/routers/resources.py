from typing import Any

from fastapi import APIRouter, Query

from app.kube import resources as kube_resources
from app.models import ApplyResourceRequest

router = APIRouter(prefix="/api/resources", tags=["resources"])


def _strip_managed_fields(data: dict[str, Any]) -> dict[str, Any]:
    for item in data.get("items", []):
        metadata = item.get("metadata")
        if isinstance(metadata, dict):
            metadata.pop("managedFields", None)
    return data


@router.get("/list")
async def list_resources(
    group: str = Query(""),
    version: str = Query(...),
    name: str = Query(...),
    namespaced: bool = Query(...),
    namespace: str | None = Query(None),
    label_selector: str | None = Query(None, alias="labelSelector"),
    field_selector: str | None = Query(None, alias="fieldSelector"),
    limit: int | None = Query(None),
    continue_token: str | None = Query(None, alias="continueToken"),
) -> dict[str, Any]:
    data = await kube_resources.list_resources(
        group=group,
        version=version,
        name=name,
        namespaced=namespaced,
        namespace=namespace,
        label_selector=label_selector,
        field_selector=field_selector,
        limit=limit,
        continue_token=continue_token,
    )
    return _strip_managed_fields(data)


@router.get("/get")
async def get_resource(
    group: str = Query(""),
    version: str = Query(...),
    name: str = Query(...),
    namespaced: bool = Query(...),
    namespace: str | None = Query(None),
    resource_name: str = Query(..., alias="resourceName"),
) -> dict[str, Any]:
    return await kube_resources.get_resource(
        group=group,
        version=version,
        name=name,
        namespaced=namespaced,
        namespace=namespace,
        resource_name=resource_name,
    )


@router.delete("/delete")
async def delete_resource(
    group: str = Query(""),
    version: str = Query(...),
    name: str = Query(...),
    namespaced: bool = Query(...),
    namespace: str | None = Query(None),
    resource_name: str = Query(..., alias="resourceName"),
) -> dict[str, Any]:
    return await kube_resources.delete_resource(
        group=group,
        version=version,
        name=name,
        namespaced=namespaced,
        namespace=namespace,
        resource_name=resource_name,
    )


@router.post("/apply")
async def apply_resource(req: ApplyResourceRequest) -> dict[str, Any]:
    return await kube_resources.apply_resource(
        group=req.group,
        version=req.version,
        name=req.name,
        namespaced=req.namespaced,
        body=req.body,
        namespace=req.namespace,
        resource_name=req.resource_name,
    )


@router.post("/patch")
async def patch_resource(req: ApplyResourceRequest) -> dict[str, Any]:
    return await kube_resources.patch_resource(
        group=req.group,
        version=req.version,
        name=req.name,
        namespaced=req.namespaced,
        body=req.body,
        namespace=req.namespace,
        resource_name=req.resource_name,
    )
