import type { KubeConfig } from '@kubernetes/client-node'
import { KubeManager } from './manager'

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

async function kubeRequest<T>(
  kubeConfig: KubeConfig,
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const cluster = kubeConfig.getCurrentCluster()
  if (!cluster) {
    throw new Error('No active cluster found in kubeconfig')
  }
  const url = `${cluster.server}${path}`
  const fetchOpts = await kubeConfig.applyToFetchOptions(
    {} as Parameters<typeof kubeConfig.applyToFetchOptions>[0],
  )
  const headers: Record<string, string> = {
    ...(fetchOpts.headers as Record<string, string> | undefined),
    Accept: 'application/json',
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }
  const response = await fetch(url, {
    ...fetchOpts,
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  return response.json() as Promise<T>
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
