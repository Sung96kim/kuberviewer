import base64
import json
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.kube.oidc import (
    _decode_jwt_payload,
    _find_cached_token,
    _refresh_token,
    exchange_auth_code,
    extract_oidc_params,
    get_oidc_token_for_exec,
    store_tokens,
)


def _make_jwt(payload: dict) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256"}).encode()).rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    sig = base64.urlsafe_b64encode(b"signature").rstrip(b"=").decode()
    return f"{header}.{body}.{sig}"


class TestDecodeJwtPayload:
    def test_decodes_standard_jwt(self):
        token = _make_jwt({"sub": "user1", "iss": "https://example.com"})
        claims = _decode_jwt_payload(token)
        assert claims["sub"] == "user1"
        assert claims["iss"] == "https://example.com"

    def test_decodes_with_padding(self):
        payload = {"sub": "a", "exp": 1234567890}
        token = _make_jwt(payload)
        claims = _decode_jwt_payload(token)
        assert claims["exp"] == 1234567890


class TestExtractOidcParams:
    def test_extracts_kubectl_oidc_login(self):
        config = {
            "command": "kubectl",
            "args": [
                "oidc-login",
                "get-token",
                "--oidc-issuer-url=https://keycloak.example.com/auth/realms/Test",
                "--oidc-client-id=my-client",
                "--oidc-client-secret=my-secret",
            ],
        }
        params = extract_oidc_params(config)
        assert params is not None
        assert params["issuer_url"] == "https://keycloak.example.com/auth/realms/Test"
        assert params["client_id"] == "my-client"
        assert params["client_secret"] == "my-secret"

    def test_extracts_kubectl_oidc_login_binary(self):
        config = {
            "command": "kubectl-oidc_login",
            "args": [
                "get-token",
                "--oidc-issuer-url=https://example.com",
                "--oidc-client-id=client",
                "--oidc-client-secret=secret",
            ],
        }
        params = extract_oidc_params(config)
        assert params is not None
        assert params["client_id"] == "client"

    def test_returns_none_for_non_oidc(self):
        config = {"command": "aws", "args": ["eks", "get-token"]}
        assert extract_oidc_params(config) is None

    def test_returns_none_when_missing_params(self):
        config = {
            "command": "kubectl",
            "args": [
                "oidc-login",
                "--oidc-issuer-url=https://example.com",
            ],
        }
        assert extract_oidc_params(config) is None

    def test_returns_none_for_empty_args(self):
        config = {"command": "kubectl", "args": []}
        assert extract_oidc_params(config) is None


class TestFindCachedToken:
    def test_finds_matching_token(self, tmp_path):
        token = _make_jwt({"iss": "https://example.com", "exp": time.time() + 3600})
        cache_file = tmp_path / "token_cache"
        cache_file.write_text(json.dumps({"id_token": token, "refresh_token": "rt123"}))

        with patch("app.kube.oidc.CACHE_DIR", tmp_path):
            result = _find_cached_token("https://example.com")
        assert result is not None
        data, path = result
        assert data["refresh_token"] == "rt123"
        assert path == cache_file

    def test_returns_none_when_no_match(self, tmp_path):
        token = _make_jwt({"iss": "https://other.com", "exp": time.time() + 3600})
        cache_file = tmp_path / "token_cache"
        cache_file.write_text(json.dumps({"id_token": token, "refresh_token": "rt"}))

        with patch("app.kube.oidc.CACHE_DIR", tmp_path):
            result = _find_cached_token("https://example.com")
        assert result is None

    def test_returns_none_when_cache_dir_missing(self, tmp_path):
        with patch("app.kube.oidc.CACHE_DIR", tmp_path / "nonexistent"):
            result = _find_cached_token("https://example.com")
        assert result is None

    def test_skips_lock_files(self, tmp_path):
        (tmp_path / "file.lock").write_text("lock")
        with patch("app.kube.oidc.CACHE_DIR", tmp_path):
            result = _find_cached_token("https://example.com")
        assert result is None

    def test_skips_entries_without_refresh_token(self, tmp_path):
        token = _make_jwt({"iss": "https://example.com", "exp": time.time() + 3600})
        cache_file = tmp_path / "token_cache"
        cache_file.write_text(json.dumps({"id_token": token}))

        with patch("app.kube.oidc.CACHE_DIR", tmp_path):
            result = _find_cached_token("https://example.com")
        assert result is None


class TestStoreTokens:
    def test_stores_new_tokens(self, tmp_path):
        with patch("app.kube.oidc.CACHE_DIR", tmp_path), \
             patch("app.kube.oidc._find_cached_token", return_value=None):
            store_tokens("https://example.com", "id-token", "refresh-token")

        files = list(tmp_path.iterdir())
        assert len(files) == 1
        data = json.loads(files[0].read_text())
        assert data["id_token"] == "id-token"
        assert data["refresh_token"] == "refresh-token"

    def test_updates_existing_cache(self, tmp_path):
        cache_file = tmp_path / "existing"
        cache_file.write_text(json.dumps({"id_token": "old", "refresh_token": "old"}))

        with patch("app.kube.oidc._find_cached_token", return_value=({"id_token": "old"}, cache_file)):
            store_tokens("https://example.com", "new-id", "new-refresh")

        data = json.loads(cache_file.read_text())
        assert data["id_token"] == "new-id"
        assert data["refresh_token"] == "new-refresh"


class TestGetOidcTokenForExec:
    def test_returns_valid_cached_token(self):
        exp = time.time() + 3600
        token = _make_jwt({"iss": "https://example.com", "exp": exp})
        config = {
            "command": "kubectl",
            "args": [
                "oidc-login",
                "--oidc-issuer-url=https://example.com",
                "--oidc-client-id=client",
                "--oidc-client-secret=secret",
            ],
        }
        cached = {"id_token": token, "refresh_token": "rt"}
        cache_path = Path("/fake/path")

        with patch("app.kube.oidc._find_cached_token", return_value=(cached, cache_path)):
            result = get_oidc_token_for_exec(config)

        assert result is not None
        assert result[0] == token
        assert result[1] == exp

    def test_returns_none_for_non_oidc(self):
        config = {"command": "aws", "args": ["eks", "get-token"]}
        assert get_oidc_token_for_exec(config) is None

    def test_returns_none_when_no_cached_token(self):
        config = {
            "command": "kubectl",
            "args": [
                "oidc-login",
                "--oidc-issuer-url=https://example.com",
                "--oidc-client-id=client",
                "--oidc-client-secret=secret",
            ],
        }
        with patch("app.kube.oidc._find_cached_token", return_value=None):
            result = get_oidc_token_for_exec(config)
        assert result is None

    def test_refreshes_expired_token(self):
        expired_token = _make_jwt({"iss": "https://example.com", "exp": time.time() - 100})
        new_exp = time.time() + 3600
        new_token = _make_jwt({"iss": "https://example.com", "exp": new_exp})

        config = {
            "command": "kubectl",
            "args": [
                "oidc-login",
                "--oidc-issuer-url=https://example.com",
                "--oidc-client-id=client",
                "--oidc-client-secret=secret",
            ],
        }
        cached = {"id_token": expired_token, "refresh_token": "rt"}
        cache_path = Path("/fake/path")

        with patch("app.kube.oidc._find_cached_token", return_value=(cached, cache_path)), \
             patch("app.kube.oidc._refresh_token", return_value=(new_token, "new-rt")):
            result = get_oidc_token_for_exec(config)

        assert result is not None
        assert result[0] == new_token
