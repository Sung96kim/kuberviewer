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

        resp = client.post("/api/contexts/delete", json={"name": "prod"})

        assert resp.status_code == 200
        assert resp.json()["deleted"] == "prod"
        assert resp.json()["current"] == "dev"
        mock_kube_manager.delete_context.assert_called_once_with("prod", switch_to=None)

    def test_deletes_active_context_with_switch_to(self, client, mock_kube_manager):
        mock_kube_manager.get_current_context.return_value = "prod"

        resp = client.post("/api/contexts/delete", json={"name": "dev", "switchTo": "prod"})

        assert resp.status_code == 200
        assert resp.json()["deleted"] == "dev"
        mock_kube_manager.delete_context.assert_called_once_with("dev", switch_to="prod")

    def test_returns_404_when_not_found(self, client, mock_kube_manager):
        mock_kube_manager.delete_context.side_effect = KeyError("Context 'missing' not found")

        resp = client.post("/api/contexts/delete", json={"name": "missing"})

        assert resp.status_code == 404

    def test_returns_400_when_active_without_switch_to(self, client, mock_kube_manager):
        mock_kube_manager.delete_context.side_effect = ValueError(
            "Cannot delete the active context without specifying switch_to"
        )

        resp = client.post("/api/contexts/delete", json={"name": "dev"})

        assert resp.status_code == 400


class TestBulkDeleteContexts:
    def test_deletes_multiple_non_active(self, client, mock_kube_manager):
        mock_kube_manager.bulk_delete_contexts.return_value = ["staging", "qa"]
        mock_kube_manager.get_current_context.return_value = "dev"

        resp = client.post("/api/contexts/bulk-delete", json={"names": ["staging", "qa"]})

        assert resp.status_code == 200
        assert resp.json()["deleted"] == ["staging", "qa"]
        assert resp.json()["current"] == "dev"
        mock_kube_manager.bulk_delete_contexts.assert_called_once_with(
            ["staging", "qa"], switch_to=None
        )

    def test_deletes_active_with_switch_to(self, client, mock_kube_manager):
        mock_kube_manager.bulk_delete_contexts.return_value = ["dev", "staging"]
        mock_kube_manager.get_current_context.return_value = "prod"

        resp = client.post(
            "/api/contexts/bulk-delete",
            json={"names": ["dev", "staging"], "switchTo": "prod"},
        )

        assert resp.status_code == 200
        assert resp.json()["deleted"] == ["dev", "staging"]
        mock_kube_manager.bulk_delete_contexts.assert_called_once_with(
            ["dev", "staging"], switch_to="prod"
        )

    def test_returns_400_when_active_without_switch_to(self, client, mock_kube_manager):
        mock_kube_manager.bulk_delete_contexts.side_effect = ValueError(
            "Cannot delete the active context without specifying switch_to"
        )

        resp = client.post("/api/contexts/bulk-delete", json={"names": ["dev"]})

        assert resp.status_code == 400

    def test_returns_404_when_not_found(self, client, mock_kube_manager):
        mock_kube_manager.bulk_delete_contexts.side_effect = KeyError(
            "Context(s) not found: missing"
        )

        resp = client.post("/api/contexts/bulk-delete", json={"names": ["missing"]})

        assert resp.status_code == 404

    def test_returns_400_when_switch_to_in_deletion_list(self, client, mock_kube_manager):
        mock_kube_manager.bulk_delete_contexts.side_effect = ValueError(
            "switch_to target cannot be in the deletion list"
        )

        resp = client.post(
            "/api/contexts/bulk-delete",
            json={"names": ["dev", "prod"], "switchTo": "dev"},
        )

        assert resp.status_code == 400
