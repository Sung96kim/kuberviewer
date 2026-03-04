import os
from unittest.mock import patch

from app.config import Settings


def test_settings_defaults():
    with patch.dict(os.environ, {}, clear=True):
        s = Settings()
    assert s.kubeconfig_path is None
    assert s.cors_origins == ["http://localhost:5173"]
    assert s.log_level == "info"
    assert s.prometheus_url is None


def test_settings_env_prefix():
    env = {
        "KUBERVIEWER_LOG_LEVEL": "debug",
        "KUBERVIEWER_PROMETHEUS_URL": "http://prom:9090",
        "KUBERVIEWER_KUBECONFIG_PATH": "/tmp/kubeconfig",
    }
    with patch.dict(os.environ, env, clear=True):
        s = Settings()
    assert s.log_level == "debug"
    assert s.prometheus_url == "http://prom:9090"
    assert s.kubeconfig_path == "/tmp/kubeconfig"


def test_settings_cors_origins_from_env():
    env = {"KUBERVIEWER_CORS_ORIGINS": '["http://a.com","http://b.com"]'}
    with patch.dict(os.environ, env, clear=True):
        s = Settings()
    assert s.cors_origins == ["http://a.com", "http://b.com"]
