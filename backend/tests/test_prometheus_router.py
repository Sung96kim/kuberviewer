from unittest.mock import AsyncMock, patch


class TestPrometheusStatusEndpoint:
    def test_available(self, client, mock_kube_manager):
        with patch("app.routers.prometheus.get_prometheus_url", return_value="http://prom:9090"), \
             patch("app.routers.prometheus.check_prometheus", new_callable=AsyncMock, return_value=True):
            resp = client.get("/api/prometheus/status")

        assert resp.status_code == 200
        data = resp.json()
        assert data["available"] is True
        assert data["url"] == "http://prom:9090"

    def test_not_configured(self, client, mock_kube_manager):
        with patch("app.routers.prometheus.get_prometheus_url", return_value=None):
            resp = client.get("/api/prometheus/status")

        assert resp.status_code == 200
        assert resp.json() == {"available": False}

    def test_unreachable(self, client, mock_kube_manager):
        with patch("app.routers.prometheus.get_prometheus_url", return_value="http://prom:9090"), \
             patch("app.routers.prometheus.check_prometheus", new_callable=AsyncMock, return_value=False):
            resp = client.get("/api/prometheus/status")

        data = resp.json()
        assert data["available"] is False
        assert data["error"] == "unreachable"


class TestPrometheusQueryRangeEndpoint:
    def test_successful_query(self, client, mock_kube_manager):
        prom_response = {"status": "success", "data": {"resultType": "matrix", "result": []}}
        with patch("app.routers.prometheus.get_prometheus_url", return_value="http://prom:9090"), \
             patch("app.routers.prometheus.query_range", new_callable=AsyncMock, return_value=prom_response):
            resp = client.post("/api/prometheus/query_range", json={
                "query": "up", "start": 1000.0, "end": 2000.0, "step": "60s",
            })

        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

    def test_prometheus_unavailable(self, client, mock_kube_manager):
        with patch("app.routers.prometheus.get_prometheus_url", return_value=None):
            resp = client.post("/api/prometheus/query_range", json={
                "query": "up", "start": 1000.0, "end": 2000.0, "step": "60s",
            })

        assert resp.status_code == 503

    def test_query_failure(self, client, mock_kube_manager):
        with patch("app.routers.prometheus.get_prometheus_url", return_value="http://prom:9090"), \
             patch("app.routers.prometheus.query_range", new_callable=AsyncMock, side_effect=Exception("timeout")):
            resp = client.post("/api/prometheus/query_range", json={
                "query": "up", "start": 1000.0, "end": 2000.0, "step": "60s",
            })

        assert resp.status_code == 502


class TestPrometheusQueryEndpoint:
    def test_successful_query(self, client, mock_kube_manager):
        prom_response = {"status": "success", "data": {"resultType": "vector", "result": []}}
        with patch("app.routers.prometheus.get_prometheus_url", return_value="http://prom:9090"), \
             patch("app.routers.prometheus.query_instant", new_callable=AsyncMock, return_value=prom_response):
            resp = client.post("/api/prometheus/query", json={"query": "up"})

        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

    def test_prometheus_unavailable(self, client, mock_kube_manager):
        with patch("app.routers.prometheus.get_prometheus_url", return_value=None):
            resp = client.post("/api/prometheus/query", json={"query": "up"})

        assert resp.status_code == 503

    def test_query_failure(self, client, mock_kube_manager):
        with patch("app.routers.prometheus.get_prometheus_url", return_value="http://prom:9090"), \
             patch("app.routers.prometheus.query_instant", new_callable=AsyncMock, side_effect=Exception("bad query")):
            resp = client.post("/api/prometheus/query", json={"query": "bad{"})

        assert resp.status_code == 502
