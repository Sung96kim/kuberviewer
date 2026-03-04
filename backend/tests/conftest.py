from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_kube_manager():
    with patch("app.kube.manager.KubeManager.get_instance") as mock:
        mgr = MagicMock()
        mock.return_value = mgr
        yield mgr
