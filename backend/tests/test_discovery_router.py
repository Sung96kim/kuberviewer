from unittest.mock import patch

from app.models import ResourceDefinition


def _make_rd(kind: str, group: str = "", namespaced: bool = True) -> ResourceDefinition:
    return ResourceDefinition(
        group=group, version="v1", kind=kind, name=kind.lower() + "s",
        singular_name=kind.lower(), namespaced=namespaced, verbs=["get", "list"],
        short_names=[], categories=[],
    )


class TestDiscoveryEndpoint:
    def test_returns_resources_and_groups(self, client, mock_kube_manager):
        resources = [_make_rd("Pod"), _make_rd("Service"), _make_rd("Deployment", group="apps")]

        with patch("app.routers.discovery.discover_apis", return_value=resources) as mock_discover, \
             patch("app.routers.discovery.group_resources") as mock_group:
            from app.models import ResourceGroup
            mock_group.return_value = [
                ResourceGroup(label="Workloads", resources=[resources[0], resources[2]]),
                ResourceGroup(label="Networking", resources=[resources[1]]),
            ]
            resp = client.get("/api/resources/discover")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["resources"]) == 3
        assert len(data["groups"]) == 2
        assert data["groups"][0]["label"] == "Workloads"

    def test_empty_discovery(self, client, mock_kube_manager):
        with patch("app.routers.discovery.discover_apis", return_value=[]), \
             patch("app.routers.discovery.group_resources", return_value=[]):
            resp = client.get("/api/resources/discover")

        assert resp.status_code == 200
        data = resp.json()
        assert data["resources"] == []
        assert data["groups"] == []
