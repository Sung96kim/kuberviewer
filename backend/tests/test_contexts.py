from app.models import ContextInfo


class TestGetContexts:
    def test_returns_contexts(self, client, mock_kube_manager):
        mock_kube_manager.get_contexts.return_value = [
            ContextInfo(name="dev", cluster="dev-cluster", user="admin", namespace="default"),
            ContextInfo(name="prod", cluster="prod-cluster", user="admin"),
        ]
        mock_kube_manager.get_current_context.return_value = "dev"

        resp = client.get("/api/contexts")

        assert resp.status_code == 200
        data = resp.json()
        assert data["current"] == "dev"
        assert len(data["contexts"]) == 2
        assert data["contexts"][0]["name"] == "dev"
        assert data["contexts"][1]["namespace"] is None

    def test_empty_contexts(self, client, mock_kube_manager):
        mock_kube_manager.get_contexts.return_value = []
        mock_kube_manager.get_current_context.return_value = ""

        resp = client.get("/api/contexts")

        assert resp.status_code == 200
        assert resp.json()["contexts"] == []


class TestSwitchContext:
    def test_switches_context(self, client, mock_kube_manager):
        mock_kube_manager.get_current_context.return_value = "prod"

        resp = client.post("/api/contexts/switch", json={"name": "prod"})

        assert resp.status_code == 200
        assert resp.json()["current"] == "prod"
        mock_kube_manager.set_context.assert_called_once_with("prod")
