import textwrap
from unittest.mock import patch

import pytest

from app.kube.manager import KubeManager


@pytest.fixture
def kubeconfig_file(tmp_path):
    config = textwrap.dedent("""\
        apiVersion: v1
        kind: Config
        current-context: dev
        contexts:
          - name: dev
            context:
              cluster: dev-cluster
              user: admin
          - name: prod
            context:
              cluster: prod-cluster
              user: admin
        clusters:
          - name: dev-cluster
            cluster:
              server: https://dev:6443
          - name: prod-cluster
            cluster:
              server: https://prod:6443
        users:
          - name: admin
            user:
              token: fake
    """)
    p = tmp_path / "kubeconfig"
    p.write_text(config)
    return str(p)


@pytest.fixture
def manager(kubeconfig_file):
    with patch("app.kube.manager.get_settings") as mock_settings:
        mock_settings.return_value.kubeconfig_path = kubeconfig_file
        KubeManager._instance = None
        mgr = KubeManager()
        yield mgr
        KubeManager._instance = None


class TestReloadContextsPreservesSwitch:
    def test_reload_does_not_override_switched_context(self, manager):
        assert manager.get_current_context() == "dev"
        manager._current_context = "prod"

        contexts = manager.get_contexts()

        assert manager.get_current_context() == "prod"
        assert len(contexts) == 2

    def test_reload_picks_up_new_contexts_from_disk(self, manager, kubeconfig_file):
        assert len(manager.get_contexts()) == 2

        with open(kubeconfig_file) as f:
            import yaml

            raw = yaml.safe_load(f)
        raw["contexts"].append(
            {"name": "staging", "context": {"cluster": "staging-cluster", "user": "admin"}}
        )
        with open(kubeconfig_file, "w") as f:
            yaml.safe_dump(raw, f)

        contexts = manager.get_contexts()

        assert len(contexts) == 3
        assert any(c.name == "staging" for c in contexts)
