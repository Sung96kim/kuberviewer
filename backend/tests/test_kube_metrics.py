import json
from unittest.mock import MagicMock

from fastapi import HTTPException

from app.kube.metrics import get_node_metrics, get_node_metrics_by_name, get_pod_metrics


def _mock_api_client(response_data: dict) -> MagicMock:
    api_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(response_data).encode()
    api_client.call_api.return_value = (mock_resp, 200, {})
    return api_client


def _mock_api_client_error(status: int = 404) -> MagicMock:
    api_client = MagicMock()
    from kubernetes.client.exceptions import ApiException
    api_client.call_api.side_effect = ApiException(status=status, reason="Not Found")
    return api_client


class TestGetNodeMetrics:
    def test_returns_metrics(self):
        data = {"kind": "NodeMetricsList", "items": [{"metadata": {"name": "node1"}, "usage": {"cpu": "250m", "memory": "1Gi"}}]}
        api_client = _mock_api_client(data)
        result = get_node_metrics(api_client)
        assert result == data

    def test_returns_none_on_error(self):
        api_client = _mock_api_client_error()
        result = get_node_metrics(api_client)
        assert result is None


class TestGetNodeMetricsByName:
    def test_returns_metrics(self):
        data = {"metadata": {"name": "node1"}, "usage": {"cpu": "250m", "memory": "1Gi"}}
        api_client = _mock_api_client(data)
        result = get_node_metrics_by_name(api_client, "node1")
        assert result == data
        api_client.call_api.assert_called_once()
        call_args = api_client.call_api.call_args
        assert "/apis/metrics.k8s.io/v1beta1/nodes/node1" == call_args[0][0]

    def test_returns_none_on_error(self):
        api_client = _mock_api_client_error()
        result = get_node_metrics_by_name(api_client, "missing")
        assert result is None


class TestGetPodMetrics:
    def test_returns_all_pod_metrics(self):
        data = {"kind": "PodMetricsList", "items": []}
        api_client = _mock_api_client(data)
        result = get_pod_metrics(api_client)
        assert result == data
        call_args = api_client.call_api.call_args
        assert call_args[0][0] == "/apis/metrics.k8s.io/v1beta1/pods"

    def test_returns_namespaced_pod_metrics(self):
        data = {"kind": "PodMetricsList", "items": []}
        api_client = _mock_api_client(data)
        result = get_pod_metrics(api_client, namespace="kube-system")
        assert result == data
        call_args = api_client.call_api.call_args
        assert call_args[0][0] == "/apis/metrics.k8s.io/v1beta1/namespaces/kube-system/pods"

    def test_returns_none_on_error(self):
        api_client = _mock_api_client_error()
        result = get_pod_metrics(api_client)
        assert result is None
