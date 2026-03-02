from fastapi import APIRouter

from app.kube.discovery import discover_apis, group_resources
from app.models import DiscoveryResponse

router = APIRouter(prefix="/api/resources", tags=["discovery"])


@router.get("/discover", response_model=DiscoveryResponse)
async def get_api_resources() -> DiscoveryResponse:
    resources = await discover_apis()
    return DiscoveryResponse(resources=resources, groups=group_resources(resources))
