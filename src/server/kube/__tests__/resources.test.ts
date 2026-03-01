import { describe, it, expect } from 'vitest'
import { buildResourceUrl } from '../resources'

describe('buildResourceUrl', () => {
  it('builds URL for core namespaced resources', () => {
    const url = buildResourceUrl({
      group: '',
      version: 'v1',
      name: 'pods',
      namespaced: true,
      namespace: 'default',
    })
    expect(url).toBe('/api/v1/namespaces/default/pods')
  })

  it('builds URL for core cluster-scoped resources', () => {
    const url = buildResourceUrl({
      group: '',
      version: 'v1',
      name: 'nodes',
      namespaced: false,
    })
    expect(url).toBe('/api/v1/nodes')
  })

  it('builds URL for API group namespaced resources', () => {
    const url = buildResourceUrl({
      group: 'apps',
      version: 'v1',
      name: 'deployments',
      namespaced: true,
      namespace: 'kube-system',
    })
    expect(url).toBe('/apis/apps/v1/namespaces/kube-system/deployments')
  })

  it('builds URL with resource name for core namespaced', () => {
    const url = buildResourceUrl({
      group: '',
      version: 'v1',
      name: 'pods',
      namespaced: true,
      namespace: 'default',
      resourceName: 'my-pod',
    })
    expect(url).toBe('/api/v1/namespaces/default/pods/my-pod')
  })

  it('builds URL with resource name for cluster-scoped', () => {
    const url = buildResourceUrl({
      group: '',
      version: 'v1',
      name: 'nodes',
      namespaced: false,
      resourceName: 'node-1',
    })
    expect(url).toBe('/api/v1/nodes/node-1')
  })

  it('builds URL for API group cluster-scoped resources', () => {
    const url = buildResourceUrl({
      group: 'rbac.authorization.k8s.io',
      version: 'v1',
      name: 'clusterroles',
      namespaced: false,
    })
    expect(url).toBe('/apis/rbac.authorization.k8s.io/v1/clusterroles')
  })

  it('builds URL for API group namespaced resource with name', () => {
    const url = buildResourceUrl({
      group: 'apps',
      version: 'v1',
      name: 'deployments',
      namespaced: true,
      namespace: 'production',
      resourceName: 'my-app',
    })
    expect(url).toBe('/apis/apps/v1/namespaces/production/deployments/my-app')
  })

  it('omits namespace for namespaced resource without namespace', () => {
    const url = buildResourceUrl({
      group: '',
      version: 'v1',
      name: 'pods',
      namespaced: true,
    })
    expect(url).toBe('/api/v1/pods')
  })

  it('builds URL for custom resources', () => {
    const url = buildResourceUrl({
      group: 'example.com',
      version: 'v1alpha1',
      name: 'widgets',
      namespaced: true,
      namespace: 'default',
    })
    expect(url).toBe('/apis/example.com/v1alpha1/namespaces/default/widgets')
  })

  it('builds URL for networking resources', () => {
    const url = buildResourceUrl({
      group: 'networking.k8s.io',
      version: 'v1',
      name: 'ingresses',
      namespaced: true,
      namespace: 'default',
      resourceName: 'my-ingress',
    })
    expect(url).toBe('/apis/networking.k8s.io/v1/namespaces/default/ingresses/my-ingress')
  })
})
