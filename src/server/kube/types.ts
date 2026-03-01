export type AuthStatus = 'authenticated' | 'pending' | 'error'

export type AuthState = {
  status: AuthStatus
  authUrl?: string
  error?: string
}

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

export type KubeError = {
  code: number
  reason: string
  message: string
}

export type WatchEvent<T = unknown> = {
  type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'ERROR'
  object: T
}
