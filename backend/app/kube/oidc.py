import base64
import hashlib
import json
import logging
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

CACHE_DIR = Path.home() / ".kube" / "cache" / "oidc-login"


def _decode_jwt_payload(token: str) -> dict[str, Any]:
    payload = token.split(".")[1]
    padding = 4 - len(payload) % 4
    payload += "=" * padding
    return json.loads(base64.urlsafe_b64decode(payload))


def _find_cached_token(issuer_url: str) -> dict[str, Any] | None:
    if not CACHE_DIR.exists():
        return None
    for path in CACHE_DIR.iterdir():
        if path.suffix == ".lock" or not path.is_file():
            continue
        try:
            data = json.loads(path.read_text())
            id_token = data.get("id_token", "")
            if not id_token or not data.get("refresh_token"):
                continue
            claims = _decode_jwt_payload(id_token)
            if claims.get("iss") == issuer_url:
                return data
        except Exception:
            continue
    return None


def _refresh_token(
    issuer_url: str,
    client_id: str,
    client_secret: str,
    refresh_token: str,
) -> str | None:
    token_url = f"{issuer_url}/protocol/openid-connect/token"
    form_data = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
    }).encode()

    req = urllib.request.Request(
        token_url,
        data=form_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return data.get("id_token")
    except Exception:
        logger.exception("OIDC token refresh failed")
        return None


def _extract_oidc_params(exec_config: dict[str, Any]) -> dict[str, str] | None:
    command = exec_config.get("command", "")
    args = exec_config.get("args", [])

    is_oidc_login = (
        (command == "kubectl" and args and args[0] == "oidc-login")
        or command == "kubectl-oidc_login"
    )
    if not is_oidc_login:
        return None

    params: dict[str, str] = {}
    for arg in args:
        for prefix, key in [
            ("--oidc-issuer-url=", "issuer_url"),
            ("--oidc-client-id=", "client_id"),
            ("--oidc-client-secret=", "client_secret"),
        ]:
            if arg.startswith(prefix):
                params[key] = arg[len(prefix):]

    if all(k in params for k in ("issuer_url", "client_id", "client_secret")):
        return params
    return None


def get_oidc_token_for_exec(
    exec_config: dict[str, Any],
) -> tuple[str, float] | None:
    params = _extract_oidc_params(exec_config)
    if not params:
        return None

    cached = _find_cached_token(params["issuer_url"])
    if not cached:
        logger.warning("No cached OIDC token found for %s", params["issuer_url"])
        return None

    id_token = cached["id_token"]
    claims = _decode_jwt_payload(id_token)
    if claims.get("exp", 0) > time.time() + 30:
        return id_token, float(claims["exp"])

    logger.info("OIDC token expired, refreshing via %s", params["issuer_url"])
    new_token = _refresh_token(
        params["issuer_url"],
        params["client_id"],
        params["client_secret"],
        cached["refresh_token"],
    )
    if not new_token:
        return None
    new_claims = _decode_jwt_payload(new_token)
    return new_token, float(new_claims["exp"])
