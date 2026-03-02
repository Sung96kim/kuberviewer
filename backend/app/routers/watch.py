from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.kube.watch import watch_resources

router = APIRouter(prefix="/api/watch", tags=["watch"])


@router.get("")
async def watch(
    group: str = Query(""),
    version: str = Query(...),
    name: str = Query(...),
    namespaced: bool = Query(...),
    namespace: str | None = Query(None),
    resource_version: str | None = Query(None, alias="resourceVersion"),
) -> StreamingResponse:
    return StreamingResponse(
        watch_resources(
            group=group,
            version=version,
            name=name,
            namespaced=namespaced,
            namespace=namespace,
            resource_version=resource_version,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
