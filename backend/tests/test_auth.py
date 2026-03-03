from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from app.routers.auth import REDIRECT_URI, _pending_states


def test_login_redirects_with_correct_redirect_uri(client, mock_kube_manager):
    mock_kube_manager.get_oidc_params.return_value = {
        "issuer_url": "https://keycloak.example.com/auth/realms/Test",
        "client_id": "test-client",
        "client_secret": "test-secret",
    }

    with patch("app.routers.auth.get_oidc_endpoints") as mock_endpoints:
        mock_endpoints.return_value = {
            "authorization_endpoint": "https://keycloak.example.com/auth/realms/Test/protocol/openid-connect/auth",
            "token_endpoint": "https://keycloak.example.com/auth/realms/Test/protocol/openid-connect/token",
        }

        resp = client.get("/api/auth/login", follow_redirects=False)

    assert resp.status_code == 307
    location = resp.headers["location"]
    parsed = urlparse(location)
    params = parse_qs(parsed.query)

    assert params["redirect_uri"] == [REDIRECT_URI]
    assert params["client_id"] == ["test-client"]
    assert params["response_type"] == ["code"]
    assert params["scope"] == ["openid"]
    assert "state" in params


def test_login_stores_state_for_callback(client, mock_kube_manager):
    _pending_states.clear()

    mock_kube_manager.get_oidc_params.return_value = {
        "issuer_url": "https://keycloak.example.com/auth/realms/Test",
        "client_id": "test-client",
        "client_secret": "test-secret",
    }

    with patch("app.routers.auth.get_oidc_endpoints") as mock_endpoints:
        mock_endpoints.return_value = {
            "authorization_endpoint": "https://keycloak.example.com/auth",
            "token_endpoint": "https://keycloak.example.com/token",
        }

        resp = client.get("/api/auth/login", follow_redirects=False)

    location = resp.headers["location"]
    params = parse_qs(urlparse(location).query)
    state = params["state"][0]

    assert state in _pending_states
    assert _pending_states[state]["client_id"] == "test-client"
    assert _pending_states[state]["client_secret"] == "test-secret"

    _pending_states.clear()


def test_login_returns_400_when_oidc_not_configured(client, mock_kube_manager):
    mock_kube_manager.get_oidc_params.return_value = None

    resp = client.get("/api/auth/login")

    assert resp.status_code == 400
    assert "OIDC not configured" in resp.text


def test_login_returns_500_when_discovery_fails(client, mock_kube_manager):
    mock_kube_manager.get_oidc_params.return_value = {
        "issuer_url": "https://keycloak.example.com/auth/realms/Test",
        "client_id": "test-client",
        "client_secret": "test-secret",
    }

    with patch("app.routers.auth.get_oidc_endpoints", return_value=None):
        resp = client.get("/api/auth/login")

    assert resp.status_code == 500
    assert "Failed to discover" in resp.text


def test_callback_exchanges_code_with_redirect_uri(client, mock_kube_manager):
    state = "test-state-123"
    _pending_states[state] = {
        "issuer_url": "https://keycloak.example.com/auth/realms/Test",
        "client_id": "test-client",
        "client_secret": "test-secret",
    }

    with patch("app.routers.auth.exchange_auth_code") as mock_exchange, \
         patch("app.routers.auth.store_tokens"):
        mock_exchange.return_value = ("id-token-abc", "refresh-token-xyz")

        resp = client.get(f"/api/auth/callback?code=auth-code-456&state={state}")

    assert resp.status_code == 200
    assert "Authenticated" in resp.text

    mock_exchange.assert_called_once_with(
        "https://keycloak.example.com/auth/realms/Test",
        "test-client",
        "test-secret",
        "auth-code-456",
        redirect_uri=REDIRECT_URI,
    )

    assert state not in _pending_states


def test_callback_returns_400_for_invalid_state(client, mock_kube_manager):
    _pending_states.clear()

    resp = client.get("/api/auth/callback?code=abc&state=bogus")

    assert resp.status_code == 400
    assert "Invalid state" in resp.text


def test_callback_returns_500_when_exchange_fails(client, mock_kube_manager):
    state = "fail-state"
    _pending_states[state] = {
        "issuer_url": "https://keycloak.example.com/auth/realms/Test",
        "client_id": "test-client",
        "client_secret": "test-secret",
    }

    with patch("app.routers.auth.exchange_auth_code", return_value=None):
        resp = client.get(f"/api/auth/callback?code=bad-code&state={state}")

    assert resp.status_code == 500
    assert "Token exchange failed" in resp.text
