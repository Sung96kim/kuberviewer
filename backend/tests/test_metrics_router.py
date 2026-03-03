from unittest.mock import patch


class TestNodeMetricsEndpoint:
    def test_returns_metrics(self, client, mock_kube_manager):
        mock_data = {
            "items": [
                {"metadata": {"name": "node1"}, "usage": {"cpu": "250m", "memory": "1Gi"}},
            ]
        }
        with patch("app.routers.metrics.get_node_metrics", return_value=mock_data):
            resp = client.get("/api/metrics/nodes")

        assert resp.status_code == 200
        data = resp.json()
        assert data["available"] is True
        assert len(data["items"]) == 1

    def test_returns_unavailable(self, client, mock_kube_manager):
        with patch("app.routers.metrics.get_node_metrics", return_value=None):
            resp = client.get("/api/metrics/nodes")

        assert resp.status_code == 200
        assert resp.json() == {"available": False}


class TestNodeMetricsByNameEndpoint:
    def test_returns_usage(self, client, mock_kube_manager):
        mock_data = {"usage": {"cpu": "500m", "memory": "2Gi"}}
        with patch("app.routers.metrics.get_node_metrics_by_name", return_value=mock_data):
            resp = client.get("/api/metrics/nodes/node1")

        assert resp.status_code == 200
        data = resp.json()
        assert data["available"] is True
        assert data["usage"]["cpu"] == "500m"

    def test_returns_unavailable(self, client, mock_kube_manager):
        with patch("app.routers.metrics.get_node_metrics_by_name", return_value=None):
            resp = client.get("/api/metrics/nodes/missing")

        assert resp.json() == {"available": False}


class TestPodMetricsEndpoint:
    def test_returns_pod_metrics(self, client, mock_kube_manager):
        mock_data = {"items": [{"metadata": {"name": "pod1"}}]}
        with patch("app.routers.metrics.get_pod_metrics", return_value=mock_data):
            resp = client.get("/api/metrics/pods")

        assert resp.status_code == 200
        assert resp.json()["available"] is True

    def test_returns_pod_metrics_with_namespace(self, client, mock_kube_manager):
        mock_data = {"items": []}
        with patch("app.routers.metrics.get_pod_metrics", return_value=mock_data) as mock_fn:
            resp = client.get("/api/metrics/pods?namespace=kube-system")

        assert resp.status_code == 200
        mock_fn.assert_called_once()

    def test_returns_unavailable(self, client, mock_kube_manager):
        with patch("app.routers.metrics.get_pod_metrics", return_value=None):
            resp = client.get("/api/metrics/pods")

        assert resp.json() == {"available": False}
