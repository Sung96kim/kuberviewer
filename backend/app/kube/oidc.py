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
DISCOVERY_CACHE_TTL = 3600

_discovery_cache: dict[str, tuple[dict[str, str], float]] = {}


def _decode_jwt_payload(token: str) -> dict[str, Any]:
    payload = token.split(".")[1]
    padding = 4 - len(payload) % 4
    payload += "=" * padding
    return json.loads(base64.urlsafe_b64decode(payload))


def _find_cached_token(issuer_url: str) -> tuple[dict[str, Any], Path] | None:
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
                return data, path
        except Exception:
            continue
    return None


def get_oidc_endpoints(issuer_url: str) -> dict[str, str] | None:
    now = time.time()
    if issuer_url in _discovery_cache:
        cached, expiry = _discovery_cache[issuer_url]
        if expiry > now:
            return cached

    discovery_url = f"{issuer_url}/.well-known/openid-configuration"
    req = urllib.request.Request(discovery_url)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            endpoints = {
                "authorization_endpoint": data["authorization_endpoint"],
                "token_endpoint": data["token_endpoint"],
            }
            _discovery_cache[issuer_url] = (endpoints, now + DISCOVERY_CACHE_TTL)
            return endpoints
    except Exception:
        logger.exception("Failed to fetch OIDC discovery for %s", issuer_url)
        return None


def _refresh_token(
    issuer_url: str,
    client_id: str,
    client_secret: str,
    refresh_token: str,
    cache_path: Path | None,
) -> tuple[str, str] | None:
    endpoints = get_oidc_endpoints(issuer_url)
    token_url = (
        endpoints["token_endpoint"]
        if endpoints
        else f"{issuer_url}/protocol/openid-connect/token"
    )
    form_data = urllib.parse.urlencode(
        {
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
        }
    ).encode()

    req = urllib.request.Request(
        token_url,
        data=form_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            new_id_token = data.get("id_token")
            new_refresh_token = data.get("refresh_token", refresh_token)
            if not new_id_token:
                return None

            if cache_path:
                try:
                    cache_data = {
                        "id_token": new_id_token,
                        "refresh_token": new_refresh_token,
                    }
                    cache_path.write_text(json.dumps(cache_data))
                    logger.info("Updated OIDC token cache at %s", cache_path)
                except Exception:
                    logger.warning("Failed to write OIDC token cache", exc_info=True)

            return new_id_token, new_refresh_token
    except Exception:
        logger.exception("OIDC token refresh failed")
        return None


def extract_oidc_params(exec_config: dict[str, Any]) -> dict[str, str] | None:
    command = exec_config.get("command", "")
    args = exec_config.get("args", [])

    is_oidc_login = (
        command == "kubectl" and args and args[0] == "oidc-login"
    ) or command == "kubectl-oidc_login"
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
                params[key] = arg[len(prefix) :]

    if all(k in params for k in ("issuer_url", "client_id", "client_secret")):
        return params
    return None


def get_oidc_token_for_exec(
    exec_config: dict[str, Any],
) -> tuple[str, float] | None:
    params = extract_oidc_params(exec_config)
    if not params:
        return None

    result = _find_cached_token(params["issuer_url"])
    if not result:
        logger.warning("No cached OIDC token found for %s", params["issuer_url"])
        return None

    cached, cache_path = result
    id_token = cached["id_token"]
    claims = _decode_jwt_payload(id_token)
    if claims.get("exp", 0) > time.time() + 30:
        return id_token, float(claims["exp"])

    logger.info("OIDC token expired, refreshing via %s", params["issuer_url"])
    refreshed = _refresh_token(
        params["issuer_url"],
        params["client_id"],
        params["client_secret"],
        cached["refresh_token"],
        cache_path,
    )
    if not refreshed:
        return None
    new_id_token, _ = refreshed
    new_claims = _decode_jwt_payload(new_id_token)
    return new_id_token, float(new_claims["exp"])


def exchange_auth_code(
    issuer_url: str,
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str | None = None,
) -> tuple[str, str] | None:
    endpoints = get_oidc_endpoints(issuer_url)
    if not endpoints:
        return None

    form: dict[str, str] = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
    }
    if redirect_uri:
        form["redirect_uri"] = redirect_uri
    form_data = urllib.parse.urlencode(form).encode()

    req = urllib.request.Request(
        endpoints["token_endpoint"],
        data=form_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            id_token = data.get("id_token")
            refresh_token = data.get("refresh_token", "")
            if not id_token:
                return None
            return id_token, refresh_token
    except Exception:
        logger.exception("OIDC auth code exchange failed")
        return None


def store_tokens(issuer_url: str, id_token: str, refresh_token: str) -> None:
    result = _find_cached_token(issuer_url)
    if result:
        _, cache_path = result
    else:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        filename = hashlib.sha256(issuer_url.encode()).hexdigest()[:16]
        cache_path = CACHE_DIR / filename

    cache_data = {"id_token": id_token, "refresh_token": refresh_token}
    cache_path.write_text(json.dumps(cache_data))
    logger.info("Stored OIDC tokens in cache at %s", cache_path)
