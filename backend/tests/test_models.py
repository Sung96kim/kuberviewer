from app.models import (
    ApplyResourceRequest,
    CamelModel,
    ContextInfo,
    ContextsResponse,
    DiscoveryResponse,
    ResourceDefinition,
    ResourceGroup,
    SwitchContextRequest,
    SwitchContextResponse,
    _to_camel,
)


def test_to_camel_single_word():
    assert _to_camel("name") == "name"


def test_to_camel_multi_word():
    assert _to_camel("singular_name") == "singularName"
    assert _to_camel("short_names") == "shortNames"


def test_to_camel_three_words():
    assert _to_camel("my_long_field") == "myLongField"


def test_context_info_serialization():
    ctx = ContextInfo(name="dev", cluster="dev-cluster", user="admin", namespace="default")
    data = ctx.model_dump(by_alias=True)
    assert data == {"name": "dev", "cluster": "dev-cluster", "user": "admin", "namespace": "default"}


def test_context_info_optional_namespace():
    ctx = ContextInfo(name="dev", cluster="dev-cluster", user="admin")
    assert ctx.namespace is None


def test_context_info_from_camel():
    ctx = ContextInfo.model_validate({"name": "dev", "cluster": "c", "user": "u", "namespace": "ns"})
    assert ctx.name == "dev"
    assert ctx.namespace == "ns"


def test_contexts_response():
    ctx = ContextInfo(name="a", cluster="c", user="u")
    resp = ContextsResponse(contexts=[ctx], current="a")
    data = resp.model_dump(by_alias=True)
    assert data["current"] == "a"
    assert len(data["contexts"]) == 1


def test_switch_context_request():
    req = SwitchContextRequest(name="prod")
    assert req.name == "prod"


def test_switch_context_response():
    resp = SwitchContextResponse(current="prod")
    assert resp.model_dump(by_alias=True) == {"current": "prod"}


def test_resource_definition_serialization():
    rd = ResourceDefinition(
        group="apps",
        version="v1",
        kind="Deployment",
        name="deployments",
        singular_name="deployment",
        namespaced=True,
        verbs=["get", "list"],
        short_names=["deploy"],
        categories=["all"],
    )
    data = rd.model_dump(by_alias=True)
    assert data["singularName"] == "deployment"
    assert data["shortNames"] == ["deploy"]
    assert data["namespaced"] is True


def test_resource_definition_from_camel():
    rd = ResourceDefinition.model_validate({
        "group": "",
        "version": "v1",
        "kind": "Pod",
        "name": "pods",
        "singularName": "pod",
        "namespaced": True,
        "verbs": ["get"],
        "shortNames": [],
        "categories": [],
    })
    assert rd.singular_name == "pod"


def test_resource_group():
    rd = ResourceDefinition(
        group="", version="v1", kind="Pod", name="pods",
        singular_name="", namespaced=True, verbs=[], short_names=[], categories=[],
    )
    rg = ResourceGroup(label="Workloads", resources=[rd])
    data = rg.model_dump(by_alias=True)
    assert data["label"] == "Workloads"
    assert len(data["resources"]) == 1


def test_discovery_response():
    rd = ResourceDefinition(
        group="", version="v1", kind="Pod", name="pods",
        singular_name="", namespaced=True, verbs=[], short_names=[], categories=[],
    )
    rg = ResourceGroup(label="Workloads", resources=[rd])
    resp = DiscoveryResponse(resources=[rd], groups=[rg])
    data = resp.model_dump(by_alias=True)
    assert len(data["resources"]) == 1
    assert len(data["groups"]) == 1


def test_apply_resource_request():
    req = ApplyResourceRequest(
        group="apps", version="v1", name="deployments",
        namespaced=True, namespace="default", resource_name="nginx",
        body={"spec": {"replicas": 3}},
    )
    assert req.resource_name == "nginx"
    data = req.model_dump(by_alias=True)
    assert data["resourceName"] == "nginx"


def test_apply_resource_request_optional_fields():
    req = ApplyResourceRequest(
        group="", version="v1", name="namespaces",
        namespaced=False, body={"metadata": {"name": "test"}},
    )
    assert req.namespace is None
    assert req.resource_name is None
