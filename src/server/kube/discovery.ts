import { KubeManager } from './manager'
import { kubeRequest } from './fetch'
import type { ResourceDefinition, ResourceGroup } from './types'

const WORKLOAD_KINDS = new Set([
  'Pod',
  'Deployment',
  'ReplicaSet',
  'StatefulSet',
  'DaemonSet',
  'Job',
  'CronJob',
  'ReplicationController',
])

const NETWORKING_KINDS = new Set([
  'Service',
  'Ingress',
  'Endpoints',
  'NetworkPolicy',
  'EndpointSlice',
])

const STORAGE_KINDS = new Set([
  'PersistentVolumeClaim',
  'PersistentVolume',
  'StorageClass',
])

const CONFIG_KINDS = new Set([
  'ConfigMap',
  'Secret',
  'ServiceAccount',
  'ResourceQuota',
  'LimitRange',
])

function getGroupLabel(resource: ResourceDefinition): string {
  if (WORKLOAD_KINDS.has(resource.kind)) return 'Workloads'
  if (NETWORKING_KINDS.has(resource.kind)) return 'Networking'
  if (STORAGE_KINDS.has(resource.kind)) return 'Storage'
  if (CONFIG_KINDS.has(resource.kind)) return 'Config'
  if (resource.group && !resource.group.endsWith('.k8s.io')) return 'Custom Resources'
  return 'Other'
}

export function groupResources(resources: ResourceDefinition[]): ResourceGroup[] {
  const groups = new Map<string, ResourceDefinition[]>()

  for (const resource of resources) {
    const label = getGroupLabel(resource)
    const existing = groups.get(label)
    if (existing) {
      existing.push(resource)
    } else {
      groups.set(label, [resource])
    }
  }

  const order = ['Workloads', 'Networking', 'Storage', 'Config', 'Custom Resources', 'Other']
  return order
    .filter((label) => groups.has(label))
    .map((label) => ({ label, resources: groups.get(label)! }))
}

type APIResourceResponse = {
  groupVersion: string
  resources: Array<{
    name: string
    singularName: string
    namespaced: boolean
    kind: string
    verbs: string[]
    shortNames?: string[]
    categories?: string[]
  }>
}

function parseResources(
  data: APIResourceResponse,
  group: string,
  version: string,
): ResourceDefinition[] {
  return data.resources
    .filter((r) => !r.name.includes('/'))
    .map((r) => ({
      group,
      version,
      kind: r.kind,
      name: r.name,
      singularName: r.singularName,
      namespaced: r.namespaced,
      verbs: r.verbs,
      shortNames: r.shortNames ?? [],
      categories: r.categories ?? [],
    }))
}

type APIGroupListResponse = {
  groups: Array<{
    name: string
    preferredVersion: {
      groupVersion: string
      version: string
    }
  }>
}

export async function discoverAPIs(): Promise<ResourceDefinition[]> {
  const manager = KubeManager.getInstance()
  const kubeConfig = manager.getKubeConfig()
  const resources: ResourceDefinition[] = []

  const coreData = await kubeRequest<APIResourceResponse>(kubeConfig, '/api/v1')
  resources.push(...parseResources(coreData, '', 'v1'))

  const groupsData = await kubeRequest<APIGroupListResponse>(kubeConfig, '/apis')
  const groupFetches = groupsData.groups.map(async (g) => {
    const gv = g.preferredVersion.groupVersion
    const version = g.preferredVersion.version
    try {
      const data = await kubeRequest<APIResourceResponse>(kubeConfig, `/apis/${gv}`)
      return parseResources(data, g.name, version)
    } catch {
      return []
    }
  })

  const groupResults = await Promise.all(groupFetches)
  for (const result of groupResults) {
    resources.push(...result)
  }

  return resources
}
