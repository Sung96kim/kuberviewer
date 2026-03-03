import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from kubernetes.client.exceptions import ApiException

from app.kube.resources import _kube_patch, _kube_request, build_resource_url


class TestBuildResourceUrl:
    def test_core_api_cluster_scoped(self):
        url = build_resource_url("", "v1", "namespaces", namespaced=False)
        assert url == "/api/v1/namespaces"

    def test_core_api_namespaced(self):
        url = build_resource_url("", "v1", "pods", namespaced=True, namespace="default")
        assert url == "/api/v1/namespaces/default/pods"

    def test_core_api_namespaced_with_resource_name(self):
        url = build_resource_url("", "v1", "pods", namespaced=True, namespace="kube-system", resource_name="coredns")
        assert url == "/api/v1/namespaces/kube-system/pods/coredns"

    def test_group_api(self):
        url = build_resource_url("apps", "v1", "deployments", namespaced=True, namespace="default")
        assert url == "/apis/apps/v1/namespaces/default/deployments"

    def test_group_api_cluster_scoped(self):
        url = build_resource_url("rbac.authorization.k8s.io", "v1", "clusterroles", namespaced=False)
        assert url == "/apis/rbac.authorization.k8s.io/v1/clusterroles"

    def test_group_api_with_resource_name(self):
        url = build_resource_url("apps", "v1", "deployments", namespaced=True, namespace="prod", resource_name="nginx")
        assert url == "/apis/apps/v1/namespaces/prod/deployments/nginx"

    def test_namespaced_without_namespace(self):
        url = build_resource_url("", "v1", "pods", namespaced=True)
        assert url == "/api/v1/pods"


class TestKubeRequest:
    def _mock_api_client(self, response_data: dict, status: int = 200) -> MagicMock:
        api_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(response_data).encode()
        api_client.call_api.return_value = (mock_resp, status, {})
        return api_client

    def test_get_request(self):
        data = {"kind": "PodList", "items": []}
        api_client = self._mock_api_client(data)
        result = _kube_request(api_client, "/api/v1/pods")
        assert result == data
        api_client.call_api.assert_called_once_with(
            "/api/v1/pods", "GET",
            query_params=[], body=None,
            response_type="object", auth_settings=["BearerToken"],
            _preload_content=False,
        )

    def test_delete_request(self):
        data = {"status": "Success"}
        api_client = self._mock_api_client(data)
        result = _kube_request(api_client, "/api/v1/pods/test", method="DELETE")
        assert result == data

    def test_post_request_with_body(self):
        body = {"metadata": {"name": "test"}}
        data = {"metadata": {"name": "test", "uid": "123"}}
        api_client = self._mock_api_client(data)
        result = _kube_request(api_client, "/api/v1/pods", method="POST", body=body)
        assert result == data

    def test_api_exception_raises_http_exception(self):
        api_client = MagicMock()
        api_client.call_api.side_effect = ApiException(status=404, reason="Not Found")
        with pytest.raises(HTTPException) as exc_info:
            _kube_request(api_client, "/api/v1/pods/missing")
        assert exc_info.value.status_code == 404

    def test_api_exception_with_json_body(self):
        api_client = MagicMock()
        error_body = json.dumps({"message": "pod not found", "code": 404})
        api_client.call_api.side_effect = ApiException(status=404, reason="Not Found")
        api_client.call_api.side_effect.body = error_body
        with pytest.raises(HTTPException) as exc_info:
            _kube_request(api_client, "/api/v1/pods/missing")
        assert exc_info.value.detail == {"message": "pod not found", "code": 404}

    def test_query_params(self):
        data = {"kind": "PodList", "items": []}
        api_client = self._mock_api_client(data)
        _kube_request(api_client, "/api/v1/pods", query_params=[("labelSelector", "app=web")])
        api_client.call_api.assert_called_once_with(
            "/api/v1/pods", "GET",
            query_params=[("labelSelector", "app=web")], body=None,
            response_type="object", auth_settings=["BearerToken"],
            _preload_content=False,
        )


class TestKubePatch:
    def test_patch_request(self):
        api_client = MagicMock()
        resp_data = {"metadata": {"name": "test"}}
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(resp_data).encode()
        api_client.call_api.return_value = (mock_resp, 200, {})

        body = {"spec": {"replicas": 5}}
        result = _kube_patch(api_client, "/apis/apps/v1/namespaces/default/deployments/nginx", body)
        assert result == resp_data
        api_client.call_api.assert_called_once_with(
            "/apis/apps/v1/namespaces/default/deployments/nginx", "PATCH",
            query_params=[], body=body,
            response_type="object", auth_settings=["BearerToken"],
            _preload_content=False,
            header_params={"Content-Type": "application/strategic-merge-patch+json"},
        )

    def test_patch_api_exception(self):
        api_client = MagicMock()
        api_client.call_api.side_effect = ApiException(status=422, reason="Unprocessable")
        with pytest.raises(HTTPException) as exc_info:
            _kube_patch(api_client, "/path", {"bad": "data"})
        assert exc_info.value.status_code == 422
