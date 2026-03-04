from unittest.mock import patch

from app.routers.cluster import _count_nodes, _count_pods


class TestCountNodes:
    def test_counts_ready_nodes(self):
        data = {
            "items": [
                {"status": {"conditions": [{"type": "Ready", "status": "True"}]}},
                {"status": {"conditions": [{"type": "Ready", "status": "False"}]}},
                {"status": {"conditions": [{"type": "Ready", "status": "True"}]}},
            ]
        }
        with patch("app.routers.cluster._kube_request", return_value=data):
            result = _count_nodes(None)
        assert result == {"total": 3, "ready": 2}

    def test_empty_cluster(self):
        with patch("app.routers.cluster._kube_request", return_value={"items": []}):
            result = _count_nodes(None)
        assert result == {"total": 0, "ready": 0}

    def test_no_conditions(self):
        data = {"items": [{"status": {"conditions": []}}, {"status": {}}]}
        with patch("app.routers.cluster._kube_request", return_value=data):
            result = _count_nodes(None)
        assert result == {"total": 2, "ready": 0}


class TestCountPods:
    def test_counts_running_pods(self):
        data = {
            "items": [
                {"status": {"phase": "Running"}},
                {"status": {"phase": "Pending"}},
                {"status": {"phase": "Running"}},
                {"status": {"phase": "Failed"}},
            ]
        }
        with patch("app.routers.cluster._kube_request", return_value=data):
            result = _count_pods(None)
        assert result == {"total": 4, "running": 2, "failed": 1, "pending": 1, "issues": {}}

    def test_empty_pods(self):
        with patch("app.routers.cluster._kube_request", return_value={"items": []}):
            result = _count_pods(None)
        assert result == {"total": 0, "running": 0, "failed": 0, "pending": 0, "issues": {}}


class TestClusterHealthEndpoint:
    def test_cluster_health(self, client, mock_kube_manager):
        mock_kube_manager.get_api_client.return_value = None

        pods_result = {"total": 10, "running": 8, "failed": 0, "pending": 2, "issues": {}}
        with patch("app.routers.cluster._count_nodes", return_value={"total": 3, "ready": 3}), \
             patch("app.routers.cluster._count_pods", return_value=pods_result), \
             patch("app.routers.cluster._count_deployments", return_value={"total": 5, "ready": 5}), \
             patch("app.routers.cluster._count_namespaces", return_value=4), \
             patch("app.routers.cluster._count_services", return_value=6):
            resp = client.get("/api/cluster/health")

        assert resp.status_code == 200
        data = resp.json()
        assert data["nodes"] == {"total": 3, "ready": 3}
        assert data["pods"] == pods_result
        assert data["deployments"] == {"total": 5, "ready": 5}
        assert data["namespaces"] == 4
        assert data["services"] == 6
