import logging
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse, RedirectResponse

from app.kube.manager import KubeManager
from app.kube.oidc import (
    _decode_jwt_payload,
    _find_cached_token,
    exchange_auth_code,
    get_oidc_endpoints,
    store_tokens,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_pending_states: dict[str, dict[str, str]] = {}

REDIRECT_URI = "http://localhost:8000/api/auth/callback"


@router.get("/status")
async def auth_status() -> dict[str, bool]:
    mgr = KubeManager.get_instance()
    params = mgr.get_oidc_params()
    if not params:
        return {"oidc_configured": False, "authenticated": False}

    import time

    result = _find_cached_token(params["issuer_url"])
    if result:
        cached, _ = result
        try:
            claims = _decode_jwt_payload(cached["id_token"])
            if claims.get("exp", 0) > time.time() + 30:
                return {"oidc_configured": True, "authenticated": True}
        except Exception:
            pass
    return {"oidc_configured": True, "authenticated": False}


@router.get("/login", response_model=None)
async def login() -> RedirectResponse | HTMLResponse:
    mgr = KubeManager.get_instance()
    params = mgr.get_oidc_params()
    if not params:
        return HTMLResponse(
            "<h1>OIDC not configured for current context</h1>", status_code=400
        )

    endpoints = get_oidc_endpoints(params["issuer_url"])
    if not endpoints:
        return HTMLResponse(
            "<h1>Failed to discover OIDC endpoints</h1>", status_code=500
        )

    state = secrets.token_urlsafe(32)
    _pending_states[state] = params

    authorize_url = endpoints["authorization_endpoint"] + "?" + urlencode({
        "response_type": "code",
        "client_id": params["client_id"],
        "redirect_uri": REDIRECT_URI,
        "scope": "openid",
        "state": state,
    })

    return RedirectResponse(authorize_url)


@router.get("/callback")
async def callback(
    code: str = Query(...), state: str = Query(...)
) -> HTMLResponse:
    params = _pending_states.pop(state, None)
    if not params:
        return HTMLResponse("<h1>Invalid state parameter</h1>", status_code=400)

    result = exchange_auth_code(
        params["issuer_url"],
        params["client_id"],
        params["client_secret"],
        code,
        REDIRECT_URI,
    )
    if not result:
        return HTMLResponse("<h1>Token exchange failed</h1>", status_code=500)

    id_token, refresh_token = result
    store_tokens(params["issuer_url"], id_token, refresh_token)

    mgr = KubeManager.get_instance()
    mgr.reset_client()

    return HTMLResponse(
        "<html><body style='display:flex;justify-content:center;align-items:center;"
        "height:100vh;font-family:sans-serif;background:#1a1a2e;color:white'>"
        "<div style='text-align:center'>"
        "<h1>Authenticated</h1>"
        "<p>You can close this tab and return to KuberViewer.</p>"
        "<script>setTimeout(()=>window.close(),2000)</script>"
        "</div></body></html>"
    )
