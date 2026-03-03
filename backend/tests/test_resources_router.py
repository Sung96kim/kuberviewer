from unittest.mock import AsyncMock, patch

from app.routers.resources import _strip_managed_fields


class TestStripManagedFields:
    def test_strips_from_single_resource(self):
        data = {
            "metadata": {"name": "test", "managedFields": [{"manager": "kubectl"}]},
            "spec": {},
        }
        result = _strip_managed_fields(data)
        assert "managedFields" not in result["metadata"]
        assert result["metadata"]["name"] == "test"

    def test_strips_from_list_items(self):
        data = {
            "metadata": {},
            "items": [
                {"metadata": {"name": "a", "managedFields": [{"manager": "kubectl"}]}},
                {"metadata": {"name": "b", "managedFields": [{"manager": "helm"}]}},
            ],
        }
        result = _strip_managed_fields(data)
        for item in result["items"]:
            assert "managedFields" not in item["metadata"]

    def test_handles_no_metadata(self):
        data = {"kind": "Status", "status": "Success"}
        result = _strip_managed_fields(data)
        assert result == data

    def test_handles_no_managed_fields(self):
        data = {"metadata": {"name": "test"}, "items": [{"metadata": {"name": "a"}}]}
        result = _strip_managed_fields(data)
        assert result["metadata"]["name"] == "test"


class TestListResourcesEndpoint:
    def test_list_resources(self, client, mock_kube_manager):
        mock_data = {
            "kind": "PodList",
            "metadata": {},
            "items": [
                {"metadata": {"name": "pod-1", "managedFields": [{}]}},
            ],
        }
        with patch("app.kube.resources.list_resources", new_callable=AsyncMock, return_value=mock_data):
            resp = client.get("/api/resources/list?version=v1&name=pods&namespaced=true&namespace=default")

        assert resp.status_code == 200
        data = resp.json()
        assert data["kind"] == "PodList"
        assert "managedFields" not in data["items"][0]["metadata"]


class TestGetResourceEndpoint:
    def test_get_resource(self, client, mock_kube_manager):
        mock_data = {
            "kind": "Pod",
            "metadata": {"name": "nginx", "managedFields": [{}]},
        }
        with patch("app.kube.resources.get_resource", new_callable=AsyncMock, return_value=mock_data):
            resp = client.get(
                "/api/resources/get?version=v1&name=pods&namespaced=true&namespace=default&resourceName=nginx"
            )

        assert resp.status_code == 200
        assert "managedFields" not in resp.json()["metadata"]


class TestDeleteResourceEndpoint:
    def test_delete_resource(self, client, mock_kube_manager):
        mock_data = {"kind": "Status", "status": "Success"}
        with patch("app.kube.resources.delete_resource", new_callable=AsyncMock, return_value=mock_data):
            resp = client.delete(
                "/api/resources/delete?version=v1&name=pods&namespaced=true&namespace=default&resourceName=nginx"
            )

        assert resp.status_code == 200
        assert resp.json()["status"] == "Success"


class TestApplyResourceEndpoint:
    def test_apply_resource(self, client, mock_kube_manager):
        mock_data = {"kind": "Pod", "metadata": {"name": "nginx", "uid": "abc"}}
        with patch("app.kube.resources.apply_resource", new_callable=AsyncMock, return_value=mock_data):
            resp = client.post("/api/resources/apply", json={
                "group": "", "version": "v1", "name": "pods",
                "namespaced": True, "namespace": "default",
                "body": {"metadata": {"name": "nginx"}},
            })

        assert resp.status_code == 200
        assert resp.json()["metadata"]["name"] == "nginx"


class TestPatchResourceEndpoint:
    def test_patch_resource(self, client, mock_kube_manager):
        mock_data = {"kind": "Deployment", "metadata": {"name": "nginx"}, "spec": {"replicas": 5}}
        with patch("app.kube.resources.patch_resource", new_callable=AsyncMock, return_value=mock_data):
            resp = client.post("/api/resources/patch", json={
                "group": "apps", "version": "v1", "name": "deployments",
                "namespaced": True, "namespace": "default", "resourceName": "nginx",
                "body": {"spec": {"replicas": 5}},
            })

        assert resp.status_code == 200
        assert resp.json()["spec"]["replicas"] == 5
