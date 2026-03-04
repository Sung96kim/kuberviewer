import logging
from typing import Any

from kubernetes import client

from app.kube.resources import _kube_request

logger = logging.getLogger(__name__)


def get_node_metrics(api_client: client.ApiClient) -> dict[str, Any] | None:
    try:
        return _kube_request(api_client, "/apis/metrics.k8s.io/v1beta1/nodes")
    except Exception:
        logger.debug("metrics-server unavailable for node metrics")
        return None


def get_node_metrics_by_name(api_client: client.ApiClient, name: str) -> dict[str, Any] | None:
    try:
        return _kube_request(api_client, f"/apis/metrics.k8s.io/v1beta1/nodes/{name}")
    except Exception:
        logger.debug("metrics-server unavailable for node %s", name)
        return None


def get_pod_metrics(api_client: client.ApiClient, namespace: str | None = None) -> dict[str, Any] | None:
    try:
        path = f"/apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods" if namespace else "/apis/metrics.k8s.io/v1beta1/pods"
        return _kube_request(api_client, path)
    except Exception:
        logger.debug("metrics-server unavailable for pod metrics")
        return None
