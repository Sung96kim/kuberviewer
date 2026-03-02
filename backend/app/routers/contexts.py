from fastapi import APIRouter

from app.kube.manager import KubeManager
from app.models import ContextsResponse, SwitchContextRequest, SwitchContextResponse

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
