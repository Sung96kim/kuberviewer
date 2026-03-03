from app.kube.discovery import (
    CONFIG_KINDS,
    GROUP_ORDER,
    NETWORKING_KINDS,
    STORAGE_KINDS,
    WORKLOAD_KINDS,
    _get_group_label,
    _parse_resources,
    group_resources,
)
from app.models import ResourceDefinition


def _make_rd(kind: str, group: str = "") -> ResourceDefinition:
    return ResourceDefinition(
        group=group, version="v1", kind=kind, name=kind.lower() + "s",
        singular_name=kind.lower(), namespaced=True, verbs=["get", "list"],
        short_names=[], categories=[],
    )


class TestGetGroupLabel:
    def test_workload_kinds(self):
        for kind in WORKLOAD_KINDS:
            assert _get_group_label(_make_rd(kind)) == "Workloads"

    def test_networking_kinds(self):
        for kind in NETWORKING_KINDS:
            assert _get_group_label(_make_rd(kind)) == "Networking"

    def test_storage_kinds(self):
        for kind in STORAGE_KINDS:
            assert _get_group_label(_make_rd(kind)) == "Storage"

    def test_config_kinds(self):
        for kind in CONFIG_KINDS:
            assert _get_group_label(_make_rd(kind)) == "Config"

    def test_custom_resource(self):
        rd = _make_rd("MyResource", group="example.com")
        assert _get_group_label(rd) == "Custom Resources"

    def test_other_k8s_io_resource(self):
        rd = _make_rd("Lease", group="coordination.k8s.io")
        assert _get_group_label(rd) == "Other"


class TestGroupResources:
    def test_groups_in_correct_order(self):
        resources = [
            _make_rd("ConfigMap"),
            _make_rd("Pod"),
            _make_rd("Service"),
            _make_rd("PersistentVolumeClaim"),
        ]
        groups = group_resources(resources)
        labels = [g.label for g in groups]
        for i, label in enumerate(labels):
            assert GROUP_ORDER.index(label) <= GROUP_ORDER.index(labels[min(i + 1, len(labels) - 1)])

    def test_empty_input(self):
        assert group_resources([]) == []

    def test_single_group(self):
        resources = [_make_rd("Pod"), _make_rd("Deployment")]
        groups = group_resources(resources)
        assert len(groups) == 1
        assert groups[0].label == "Workloads"
        assert len(groups[0].resources) == 2


class TestParseResources:
    def test_parses_resources(self):
        data = {
            "resources": [
                {
                    "name": "pods",
                    "kind": "Pod",
                    "namespaced": True,
                    "verbs": ["get", "list", "create"],
                    "shortNames": ["po"],
                    "categories": ["all"],
                },
                {
                    "name": "pods/log",
                    "kind": "Pod",
                    "namespaced": True,
                    "verbs": ["get"],
                },
            ]
        }
        result = _parse_resources(data, "", "v1")
        assert len(result) == 1
        assert result[0].name == "pods"
        assert result[0].kind == "Pod"
        assert result[0].short_names == ["po"]

    def test_skips_subresources(self):
        data = {
            "resources": [
                {"name": "deployments", "kind": "Deployment", "namespaced": True, "verbs": ["get"]},
                {"name": "deployments/scale", "kind": "Scale", "namespaced": True, "verbs": ["get"]},
                {"name": "deployments/status", "kind": "Deployment", "namespaced": True, "verbs": ["get"]},
            ]
        }
        result = _parse_resources(data, "apps", "v1")
        assert len(result) == 1
        assert result[0].group == "apps"

    def test_empty_resources(self):
        result = _parse_resources({}, "", "v1")
        assert result == []

    def test_missing_optional_fields(self):
        data = {
            "resources": [
                {"name": "configmaps", "kind": "ConfigMap", "namespaced": True},
            ]
        }
        result = _parse_resources(data, "", "v1")
        assert result[0].verbs == []
        assert result[0].short_names == []
        assert result[0].singular_name == ""
