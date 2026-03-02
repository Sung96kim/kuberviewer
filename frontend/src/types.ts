export type ContextInfo = {
  name: string
  cluster: string
  user: string
  namespace?: string
}

export type ResourceDefinition = {
  group: string
  version: string
  kind: string
  name: string
  singularName: string
  namespaced: boolean
  verbs: string[]
  shortNames: string[]
  categories: string[]
}

export type ResourceGroup = {
  label: string
  resources: ResourceDefinition[]
}
