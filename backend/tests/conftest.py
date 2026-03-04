from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.kube.manager import get_kube_manager
from app.main import app


@pytest.fixture
def mock_kube_manager():
    mgr = MagicMock()
    app.dependency_overrides[get_kube_manager] = lambda: mgr
    yield mgr
    app.dependency_overrides.pop(get_kube_manager, None)


@pytest.fixture
def client():
    return TestClient(app)
