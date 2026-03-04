import json

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


class TestDeleteContext:
    def test_deletes_non_active_context(self, client, mock_kube_manager):
        mock_kube_manager.get_current_context.return_value = "dev"

        resp = client.delete("/api/contexts/prod")

        assert resp.status_code == 200
        assert resp.json()["deleted"] == "prod"
        assert resp.json()["current"] == "dev"
        mock_kube_manager.delete_context.assert_called_once_with("prod", switch_to=None)

    def test_deletes_active_context_with_switch_to(self, client, mock_kube_manager):
        mock_kube_manager.get_current_context.return_value = "prod"

        resp = client.request("DELETE", "/api/contexts/dev", content=json.dumps({"switchTo": "prod"}), headers={"Content-Type": "application/json"})

        assert resp.status_code == 200
        assert resp.json()["deleted"] == "dev"
        mock_kube_manager.delete_context.assert_called_once_with("dev", switch_to="prod")

    def test_returns_404_when_not_found(self, client, mock_kube_manager):
        mock_kube_manager.delete_context.side_effect = KeyError("Context 'missing' not found")

        resp = client.delete("/api/contexts/missing")

        assert resp.status_code == 404

    def test_returns_400_when_active_without_switch_to(self, client, mock_kube_manager):
        mock_kube_manager.delete_context.side_effect = ValueError(
            "Cannot delete the active context without specifying switch_to"
        )

        resp = client.delete("/api/contexts/dev")

        assert resp.status_code == 400
