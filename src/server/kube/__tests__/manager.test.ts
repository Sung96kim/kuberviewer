import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KubeManager } from '../manager'

vi.mock('@kubernetes/client-node', () => {
  const mockContext = {
    name: 'test-context',
    cluster: 'test-cluster',
    user: 'test-user',
    namespace: 'default',
  }
  const mockKubeConfig = {
    loadFromDefault: vi.fn(),
    getContexts: vi.fn(() => [mockContext]),
    getCurrentContext: vi.fn(() => 'test-context'),
    setCurrentContext: vi.fn(),
    getContextObject: vi.fn(() => mockContext),
    makeApiClient: vi.fn(() => ({})),
  }
  return {
    KubeConfig: vi.fn(() => mockKubeConfig),
    ApisApi: class {},
    CoreV1Api: class {},
    CustomObjectsApi: class {},
  }
})

describe('KubeManager', () => {
  beforeEach(() => {
    KubeManager.resetInstance()
  })

  it('returns a singleton instance', () => {
    const a = KubeManager.getInstance()
    const b = KubeManager.getInstance()
    expect(a).toBe(b)
  })

  it('loads contexts from kubeconfig', () => {
    const manager = KubeManager.getInstance()
    const contexts = manager.getContexts()
    expect(contexts).toHaveLength(1)
    expect(contexts[0].name).toBe('test-context')
  })

  it('returns current context', () => {
    const manager = KubeManager.getInstance()
    expect(manager.getCurrentContext()).toBe('test-context')
  })

  it('switches context', () => {
    const manager = KubeManager.getInstance()
    manager.setContext('test-context')
    expect(manager.getCurrentContext()).toBe('test-context')
  })

  it('resets singleton instance', () => {
    const a = KubeManager.getInstance()
    KubeManager.resetInstance()
    const b = KubeManager.getInstance()
    expect(a).not.toBe(b)
  })

  it('provides API clients', () => {
    const manager = KubeManager.getInstance()
    expect(manager.getCoreV1Api()).toBeDefined()
    expect(manager.getCustomObjectsApi()).toBeDefined()
    expect(manager.getApisApi()).toBeDefined()
  })

  it('caches clients for the same context', () => {
    const manager = KubeManager.getInstance()
    const first = manager.getCoreV1Api()
    const second = manager.getCoreV1Api()
    expect(first).toBe(second)
  })
})
