import { describe, it, expect } from 'vitest'
import { groupResources } from '../discovery'
import type { ResourceDefinition } from '../types'

function makeResource(overrides: Partial<ResourceDefinition> = {}): ResourceDefinition {
  return {
    group: '',
    version: 'v1',
    kind: 'Unknown',
    name: 'unknowns',
    singularName: 'unknown',
    namespaced: true,
    verbs: ['get', 'list'],
    shortNames: [],
    categories: [],
    ...overrides,
  }
}

describe('groupResources', () => {
  it('groups workload resources', () => {
    const resources = [
      makeResource({ kind: 'Pod', name: 'pods' }),
      makeResource({ kind: 'Deployment', name: 'deployments', group: 'apps', version: 'v1' }),
      makeResource({ kind: 'StatefulSet', name: 'statefulsets', group: 'apps', version: 'v1' }),
    ]
    const groups = groupResources(resources)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Workloads')
    expect(groups[0].resources).toHaveLength(3)
  })

  it('groups networking resources', () => {
    const resources = [
      makeResource({ kind: 'Service', name: 'services' }),
      makeResource({ kind: 'Ingress', name: 'ingresses', group: 'networking.k8s.io' }),
    ]
    const groups = groupResources(resources)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Networking')
    expect(groups[0].resources).toHaveLength(2)
  })

  it('groups storage resources', () => {
    const resources = [
      makeResource({ kind: 'PersistentVolumeClaim', name: 'persistentvolumeclaims' }),
      makeResource({ kind: 'StorageClass', name: 'storageclasses', group: 'storage.k8s.io', namespaced: false }),
    ]
    const groups = groupResources(resources)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Storage')
  })

  it('groups configuration resources', () => {
    const resources = [
      makeResource({ kind: 'ConfigMap', name: 'configmaps' }),
      makeResource({ kind: 'Secret', name: 'secrets' }),
      makeResource({ kind: 'ServiceAccount', name: 'serviceaccounts' }),
    ]
    const groups = groupResources(resources)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Configuration')
    expect(groups[0].resources).toHaveLength(3)
  })

  it('puts non-k8s.io group resources in Custom Resources', () => {
    const resources = [
      makeResource({ kind: 'MyCustom', name: 'mycustoms', group: 'example.com' }),
    ]
    const groups = groupResources(resources)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Custom Resources')
  })

  it('puts k8s.io group resources not in named categories into Other', () => {
    const resources = [
      makeResource({ kind: 'Lease', name: 'leases', group: 'coordination.k8s.io' }),
    ]
    const groups = groupResources(resources)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Other')
  })

  it('puts core resources not in named categories into Other', () => {
    const resources = [
      makeResource({ kind: 'Namespace', name: 'namespaces', group: '' }),
    ]
    const groups = groupResources(resources)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Other')
  })

  it('orders groups correctly with mixed resources', () => {
    const resources = [
      makeResource({ kind: 'ConfigMap', name: 'configmaps' }),
      makeResource({ kind: 'Pod', name: 'pods' }),
      makeResource({ kind: 'Service', name: 'services' }),
      makeResource({ kind: 'PersistentVolumeClaim', name: 'persistentvolumeclaims' }),
      makeResource({ kind: 'MyCustom', name: 'mycustoms', group: 'example.com' }),
      makeResource({ kind: 'Lease', name: 'leases', group: 'coordination.k8s.io' }),
    ]
    const groups = groupResources(resources)
    const labels = groups.map((g) => g.label)
    expect(labels).toEqual([
      'Workloads',
      'Networking',
      'Storage',
      'Configuration',
      'Custom Resources',
      'Other',
    ])
  })

  it('returns empty array for empty input', () => {
    const groups = groupResources([])
    expect(groups).toHaveLength(0)
  })

  it('handles all workload kinds', () => {
    const workloadKinds = [
      'Pod', 'Deployment', 'ReplicaSet', 'StatefulSet',
      'DaemonSet', 'Job', 'CronJob', 'ReplicationController',
    ]
    const resources = workloadKinds.map((kind) =>
      makeResource({ kind, name: kind.toLowerCase() + 's' }),
    )
    const groups = groupResources(resources)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Workloads')
    expect(groups[0].resources).toHaveLength(8)
  })
})
