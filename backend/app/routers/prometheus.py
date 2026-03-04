import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.kube.prometheus import check_prometheus, get_prometheus_url, query_instant, query_range

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/prometheus", tags=["prometheus"])


class QueryRangeRequest(BaseModel):
    query: str
    start: float
    end: float
    step: str = "60s"


class InstantQueryRequest(BaseModel):
    query: str


@router.get("/status")
async def prometheus_status() -> dict[str, Any]:
    url = await asyncio.to_thread(get_prometheus_url)
    if not url:
        return {"available": False}

    reachable = await check_prometheus(url)
    if not reachable:
        return {"available": False, "url": url, "error": "unreachable"}

    return {"available": True, "url": url}


@router.post("/query_range")
async def prometheus_query_range(req: QueryRangeRequest) -> dict[str, Any]:
    url = await asyncio.to_thread(get_prometheus_url)
    if not url:
        raise HTTPException(status_code=503, detail="Prometheus not available")

    try:
        return await query_range(url, req.query, req.start, req.end, req.step)
    except Exception as e:
        logger.exception("Prometheus query_range failed")
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/query")
async def prometheus_query(req: InstantQueryRequest) -> dict[str, Any]:
    url = await asyncio.to_thread(get_prometheus_url)
    if not url:
        raise HTTPException(status_code=503, detail="Prometheus not available")

    try:
        return await query_instant(url, req.query)
    except Exception as e:
        logger.exception("Prometheus instant query failed")
        raise HTTPException(status_code=502, detail=str(e))
