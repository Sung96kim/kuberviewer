from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.kube.logs import stream_pod_logs

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("")
async def get_pod_logs(
    namespace: str = Query(...),
    pod: str = Query(...),
    container: str | None = Query(None),
    tailLines: int | None = Query(None),
    sinceSeconds: int | None = Query(None),
    timestamps: bool = Query(False),
    follow: bool = Query(True),
    previous: bool = Query(False),
) -> StreamingResponse:
    return StreamingResponse(
        stream_pod_logs(
            namespace=namespace,
            pod_name=pod,
            container=container,
            tail_lines=tailLines,
            since_seconds=sinceSeconds,
            timestamps=timestamps,
            follow=follow,
            previous=previous,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
