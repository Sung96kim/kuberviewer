from fastapi import APIRouter, Depends, HTTPException

from app.kube.manager import KubeManager, get_kube_manager
from app.models import (
    BulkDeleteContextRequest,
    BulkDeleteContextResponse,
    ContextsResponse,
    DeleteContextRequest,
    DeleteContextResponse,
    SwitchContextRequest,
    SwitchContextResponse,
)

router = APIRouter(prefix="/api/contexts", tags=["contexts"])


@router.get("", response_model=ContextsResponse)
async def get_contexts(mgr: KubeManager = Depends(get_kube_manager)) -> ContextsResponse:
    return ContextsResponse(
        contexts=mgr.get_contexts(), current=mgr.get_current_context()
    )


@router.post("/switch", response_model=SwitchContextResponse)
async def switch_context(body: SwitchContextRequest, mgr: KubeManager = Depends(get_kube_manager)) -> SwitchContextResponse:
    mgr.set_context(body.name)
    return SwitchContextResponse(current=mgr.get_current_context())


@router.post("/delete", response_model=DeleteContextResponse)
async def delete_context(body: DeleteContextRequest, mgr: KubeManager = Depends(get_kube_manager)) -> DeleteContextResponse:
    try:
        mgr.delete_context(body.name, switch_to=body.switch_to)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return DeleteContextResponse(deleted=body.name, current=mgr.get_current_context())


@router.post("/bulk-delete", response_model=BulkDeleteContextResponse)
async def bulk_delete_contexts(body: BulkDeleteContextRequest, mgr: KubeManager = Depends(get_kube_manager)) -> BulkDeleteContextResponse:
    try:
        deleted = mgr.bulk_delete_contexts(body.names, switch_to=body.switch_to)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return BulkDeleteContextResponse(deleted=deleted, current=mgr.get_current_context())
