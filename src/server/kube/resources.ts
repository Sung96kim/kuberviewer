import { KubeManager } from './manager'
import { kubeRequest } from './fetch'

type BuildResourceUrlParams = {
  group: string
  version: string
  name: string
  namespaced: boolean
  namespace?: string
  resourceName?: string
}

export function buildResourceUrl(params: BuildResourceUrlParams): string {
  const { group, version, name, namespaced, namespace, resourceName } = params
  const base = group ? `/apis/${group}/${version}` : `/api/${version}`
  const namespacePart = namespaced && namespace ? `/namespaces/${namespace}` : ''
  const resourcePart = resourceName ? `/${resourceName}` : ''
  return `${base}${namespacePart}/${name}${resourcePart}`
}

type ListResourcesParams = {
  group: string
  version: string
  name: string
  namespaced: boolean
  namespace?: string
  labelSelector?: string
  fieldSelector?: string
  limit?: number
  continueToken?: string
}

export async function listResources(params: ListResourcesParams): Promise<unknown> {
  const kubeConfig = KubeManager.getInstance().getKubeConfig()
  const path = buildResourceUrl(params)
  const searchParams = new URLSearchParams()
  if (params.labelSelector) searchParams.set('labelSelector', params.labelSelector)
  if (params.fieldSelector) searchParams.set('fieldSelector', params.fieldSelector)
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.continueToken) searchParams.set('continue', params.continueToken)
  const query = searchParams.toString()
  const fullPath = query ? `${path}?${query}` : path
  return kubeRequest(kubeConfig, fullPath, 'GET')
}

type GetResourceParams = {
  group: string
  version: string
  name: string
  namespaced: boolean
  namespace?: string
  resourceName: string
}

export async function getResource(params: GetResourceParams): Promise<unknown> {
  const kubeConfig = KubeManager.getInstance().getKubeConfig()
  const path = buildResourceUrl(params)
  return kubeRequest(kubeConfig, path, 'GET')
}

type DeleteResourceParams = {
  group: string
  version: string
  name: string
  namespaced: boolean
  namespace?: string
  resourceName: string
}

export async function deleteResource(params: DeleteResourceParams): Promise<unknown> {
  const kubeConfig = KubeManager.getInstance().getKubeConfig()
  const path = buildResourceUrl(params)
  return kubeRequest(kubeConfig, path, 'DELETE')
}

type ApplyResourceParams = {
  group: string
  version: string
  name: string
  namespaced: boolean
  namespace?: string
  resourceName?: string
  body: unknown
}

export async function applyResource(params: ApplyResourceParams): Promise<unknown> {
  const kubeConfig = KubeManager.getInstance().getKubeConfig()
  const path = buildResourceUrl(params)
  const method = params.resourceName ? 'PUT' : 'POST'
  return kubeRequest(kubeConfig, path, method, params.body)
}
