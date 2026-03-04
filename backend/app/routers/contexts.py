from fastapi import APIRouter, HTTPException

from app.kube.manager import KubeManager
from app.models import (
    ContextsResponse,
    DeleteContextRequest,
    DeleteContextResponse,
    SwitchContextRequest,
    SwitchContextResponse,
)

router = APIRouter(prefix="/api/contexts", tags=["contexts"])


@router.get("", response_model=ContextsResponse)
async def get_contexts() -> ContextsResponse:
    mgr = KubeManager.get_instance()
    return ContextsResponse(
        contexts=mgr.get_contexts(), current=mgr.get_current_context()
    )


@router.post("/switch", response_model=SwitchContextResponse)
async def switch_context(body: SwitchContextRequest) -> SwitchContextResponse:
    mgr = KubeManager.get_instance()
    mgr.set_context(body.name)
    return SwitchContextResponse(current=mgr.get_current_context())


@router.delete("/{name}", response_model=DeleteContextResponse)
async def delete_context(name: str, body: DeleteContextRequest | None = None) -> DeleteContextResponse:
    mgr = KubeManager.get_instance()
    switch_to = body.switch_to if body else None
    try:
        mgr.delete_context(name, switch_to=switch_to)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return DeleteContextResponse(deleted=name, current=mgr.get_current_context())
