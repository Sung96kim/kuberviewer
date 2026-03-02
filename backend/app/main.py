from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.kube.manager import KubeManager, OIDCAuthRequired
from app.routers import auth, cluster, contexts, discovery, exec, logs, resources, watch


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

@app.exception_handler(OIDCAuthRequired)
async def oidc_auth_required_handler(_request: Request, exc: OIDCAuthRequired) -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={
            "error": "oidc_auth_required",
            "message": str(exc),
            "login_url": "/api/auth/login",
        },
    )


app.include_router(auth.router)
app.include_router(cluster.router)
app.include_router(contexts.router)
app.include_router(discovery.router)
app.include_router(exec.router)
app.include_router(logs.router)
app.include_router(resources.router)
app.include_router(watch.router)
