from pydantic import BaseModel, ConfigDict


def _to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)


class ContextInfo(CamelModel):
    name: str
    cluster: str
    user: str
    namespace: str | None = None


class ContextsResponse(CamelModel):
    contexts: list[ContextInfo]
    current: str


class SwitchContextRequest(CamelModel):
    name: str


class SwitchContextResponse(CamelModel):
    current: str


class DeleteContextRequest(CamelModel):
    switch_to: str | None = None


class DeleteContextResponse(CamelModel):
    deleted: str
    current: str


class ResourceDefinition(CamelModel):
    group: str
    version: str
    kind: str
    name: str
    singular_name: str
    namespaced: bool
    verbs: list[str]
    short_names: list[str]
    categories: list[str]


class ResourceGroup(CamelModel):
    label: str
    resources: list[ResourceDefinition]


class DiscoveryResponse(CamelModel):
    resources: list[ResourceDefinition]
    groups: list[ResourceGroup]


class ApplyResourceRequest(CamelModel):
    group: str
    version: str
    name: str
    namespaced: bool
    namespace: str | None = None
    resource_name: str | None = None
    body: dict


class ScaleResourceRequest(CamelModel):
    group: str
    version: str
    name: str
    namespaced: bool
    namespace: str | None = None
    resource_name: str | None = None
    replicas: int
