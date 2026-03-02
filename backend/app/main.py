from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.kube.manager import KubeManager
from app.routers import contexts, discovery, exec, logs, resources, watch


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    KubeManager.get_instance()
    yield


app = FastAPI(title="KuberViewer API", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contexts.router)
app.include_router(discovery.router)
app.include_router(exec.router)
app.include_router(logs.router)
app.include_router(resources.router)
app.include_router(watch.router)
