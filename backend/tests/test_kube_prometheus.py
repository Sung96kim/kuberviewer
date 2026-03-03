import json
from unittest.mock import MagicMock, patch

import pytest

from app.kube.prometheus import (
    PROMETHEUS_NAMESPACES,
    PROMETHEUS_SERVICE_NAMES,
    _discover_prometheus_service,
    get_prometheus_url,
    reset_prometheus_cache,
)


def _mock_api_client_with_services(services_by_ns: dict[str, list[dict]]) -> MagicMock:
    api_client = MagicMock()

    def call_api_side_effect(path, method, **kwargs):
        for ns, services in services_by_ns.items():
            if f"/api/v1/namespaces/{ns}/services" == path:
                data = {"items": services}
                mock_resp = MagicMock()
                mock_resp.read.return_value = json.dumps(data).encode()
                return (mock_resp, 200, {})
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({"items": []}).encode()
        return (mock_resp, 200, {})

    api_client.call_api.side_effect = call_api_side_effect
    return api_client


class TestDiscoverPrometheusService:
    def test_finds_prometheus_server(self):
        services = [{
            "metadata": {"name": "prometheus-server"},
            "spec": {"ports": [{"name": "http", "port": 9090}]},
        }]
        api_client = _mock_api_client_with_services({"monitoring": services})
        url = _discover_prometheus_service(api_client)
        assert url == "http://prometheus-server.monitoring.svc.cluster.local:9090"

    def test_finds_prometheus_operated(self):
        services = [{
            "metadata": {"name": "prometheus-operated"},
            "spec": {"ports": [{"name": "web", "port": 9090}]},
        }]
        api_client = _mock_api_client_with_services({"prometheus": services})
        url = _discover_prometheus_service(api_client)
        assert url == "http://prometheus-operated.prometheus.svc.cluster.local:9090"

    def test_returns_none_when_not_found(self):
        api_client = _mock_api_client_with_services({})
        url = _discover_prometheus_service(api_client)
        assert url is None

    def test_uses_first_port_when_no_matching_name(self):
        services = [{
            "metadata": {"name": "prometheus-server"},
            "spec": {"ports": [{"name": "custom", "port": 8080}]},
        }]
        api_client = _mock_api_client_with_services({"monitoring": services})
        url = _discover_prometheus_service(api_client)
        assert url == "http://prometheus-server.monitoring.svc.cluster.local:8080"

    def test_skips_non_matching_service_names(self):
        services = [{
            "metadata": {"name": "my-custom-prometheus"},
            "spec": {"ports": [{"port": 9090}]},
        }]
        api_client = _mock_api_client_with_services({"monitoring": services})
        url = _discover_prometheus_service(api_client)
        assert url is None


class TestGetPrometheusUrl:
    def setup_method(self):
        reset_prometheus_cache()

    def test_returns_configured_url(self):
        with patch("app.kube.prometheus.get_settings") as mock_settings:
            mock_settings.return_value.prometheus_url = "http://configured:9090"
            url = get_prometheus_url()
        assert url == "http://configured:9090"

    def test_returns_cached_url(self):
        import app.kube.prometheus as prom_module
        prom_module._cached_url = "http://cached:9090"
        with patch("app.kube.prometheus.get_settings") as mock_settings:
            mock_settings.return_value.prometheus_url = None
            url = get_prometheus_url()
        assert url == "http://cached:9090"
        reset_prometheus_cache()

    def test_discovers_and_caches(self):
        with patch("app.kube.prometheus.get_settings") as mock_settings, \
             patch("app.kube.prometheus.KubeManager") as mock_mgr_cls, \
             patch("app.kube.prometheus._discover_prometheus_service") as mock_discover:
            mock_settings.return_value.prometheus_url = None
            mock_discover.return_value = "http://discovered:9090"
            url = get_prometheus_url()
        assert url == "http://discovered:9090"
        reset_prometheus_cache()

    def test_returns_none_when_nothing_found(self):
        with patch("app.kube.prometheus.get_settings") as mock_settings, \
             patch("app.kube.prometheus.KubeManager") as mock_mgr_cls, \
             patch("app.kube.prometheus._discover_prometheus_service", return_value=None):
            mock_settings.return_value.prometheus_url = None
            url = get_prometheus_url()
        assert url is None
