import { describe, it, expect } from 'vitest'
import {
  getStatusClasses,
  extractPodPrefix,
  getPodPhase,
  precomputePodRows,
  getColumnsForKind,
  parseResourcePath,
} from '../resource-helpers'

describe('getStatusClasses', () => {
  it('returns classes for known statuses', () => {
    const result = getStatusClasses('Running')
    expect(result.badge).toContain('emerald')
    expect(result.dot).toContain('emerald')
  })

  it('is case-insensitive', () => {
    expect(getStatusClasses('RUNNING')).toEqual(getStatusClasses('running'))
  })

  it('returns default classes for unknown status', () => {
    const result = getStatusClasses('SomeRandomStatus')
    expect(result.badge).toContain('slate')
  })

  it('returns red classes for error statuses', () => {
    for (const status of ['Failed', 'CrashLoopBackOff', 'Error']) {
      expect(getStatusClasses(status).badge).toContain('red')
    }
  })

  it('returns amber classes for pending statuses', () => {
    for (const status of ['Pending', 'Waiting', 'Terminating']) {
      expect(getStatusClasses(status).badge).toContain('amber')
    }
  })
})

describe('extractPodPrefix', () => {
  it('strips generated hash suffix', () => {
    expect(extractPodPrefix('nginx-7f8c9d6b4f')).toBe('nginx')
  })

  it('strips random short suffix', () => {
    expect(extractPodPrefix('nginx-deployment-7f8c9d6b4f-x2k4p')).toBe('nginx-deployment')
  })

  it('preserves meaningful segments', () => {
    expect(extractPodPrefix('frontend-service')).toBe('frontend-service')
  })

  it('returns single segment names unchanged', () => {
    expect(extractPodPrefix('nginx')).toBe('nginx')
  })

  it('handles multiple hash-like suffixes', () => {
    expect(extractPodPrefix('coredns-5d78c9869d-abc12')).toBe('coredns')
  })
})

describe('getPodPhase', () => {
  it('returns phase from status', () => {
    const item = { status: { phase: 'Running' } }
    expect(getPodPhase(item)).toBe('Running')
  })

  it('returns waiting reason when container is waiting', () => {
    const item = {
      status: {
        phase: 'Pending',
        containerStatuses: [
          { state: { waiting: { reason: 'CrashLoopBackOff' } } },
        ],
      },
    }
    expect(getPodPhase(item)).toBe('CrashLoopBackOff')
  })

  it('returns terminated reason', () => {
    const item = {
      status: {
        phase: 'Failed',
        containerStatuses: [
          { state: { terminated: { reason: 'OOMKilled' } } },
        ],
      },
    }
    expect(getPodPhase(item)).toBe('OOMKilled')
  })

  it('returns Unknown when no status', () => {
    expect(getPodPhase({})).toBe('Unknown')
  })

  it('falls back to phase when no container reason', () => {
    const item = {
      status: {
        phase: 'Pending',
        containerStatuses: [{ state: { running: {} } }],
      },
    }
    expect(getPodPhase(item)).toBe('Pending')
  })
})

describe('precomputePodRows', () => {
  it('adds _computed fields to each pod', () => {
    const items = [
      {
        metadata: { name: 'nginx-deployment-abc123-x2k4p' },
        status: {
          phase: 'Running',
          containerStatuses: [
            { ready: true, restartCount: 3, state: { running: {} } },
          ],
        },
        spec: { nodeName: 'node-1' },
      },
    ]

    const result = precomputePodRows(items)
    const computed = result[0]._computed as Record<string, unknown>
    expect(computed.podPrefix).toBe('nginx-deployment')
    expect(computed.phase).toBe('Running')
    expect(computed.containers).toBe('1/1')
    expect(computed.restarts).toBe(3)
    expect(computed.node).toBe('node-1')
  })

  it('handles empty items', () => {
    expect(precomputePodRows([])).toEqual([])
  })
})

describe('getColumnsForKind', () => {
  it('returns pod columns for Pod kind', () => {
    const cols = getColumnsForKind('Pod')
    const ids = cols.map((c) => c.id)
    expect(ids).toContain('status')
    expect(ids).toContain('containers')
    expect(ids).toContain('restarts')
    expect(ids).toContain('node')
  })

  it('returns deployment columns for Deployment kind', () => {
    const cols = getColumnsForKind('Deployment')
    const ids = cols.map((c) => c.id)
    expect(ids).toContain('ready')
    expect(ids).toContain('upToDate')
    expect(ids).toContain('available')
  })

  it('returns service columns for Service kind', () => {
    const cols = getColumnsForKind('Service')
    const ids = cols.map((c) => c.id)
    expect(ids).toContain('type')
    expect(ids).toContain('clusterIP')
    expect(ids).toContain('ports')
  })

  it('returns default columns for unknown kind', () => {
    const cols = getColumnsForKind('CustomResource')
    const ids = cols.map((c) => c.id)
    expect(ids).toEqual(['name', 'namespace', 'age'])
  })

  it('returns columns for all known kinds', () => {
    const kinds = [
      'Pod', 'Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet',
      'Job', 'CronJob', 'Service', 'Ingress', 'ConfigMap', 'Secret',
      'ServiceAccount', 'PersistentVolumeClaim', 'Node', 'Namespace',
    ]
    for (const kind of kinds) {
      const cols = getColumnsForKind(kind)
      expect(cols.length).toBeGreaterThan(0)
      expect(cols.some((c) => c.id === 'name')).toBe(true)
    }
  })
})

describe('parseResourcePath', () => {
  it('parses core resource list (v1/pods)', () => {
    const result = parseResourcePath('v1/pods')
    expect(result).toEqual({ type: 'list', group: '', version: 'v1', resourceName: 'pods' })
  })

  it('parses group resource list (apps/v1/deployments)', () => {
    const result = parseResourcePath('apps/v1/deployments')
    expect(result).toEqual({ type: 'list', group: 'apps', version: 'v1', resourceName: 'deployments' })
  })

  it('parses core non-namespaced detail (v1/nodes/my-node)', () => {
    const result = parseResourcePath('v1/nodes/my-node')
    expect(result).toEqual({ type: 'detail', group: '', version: 'v1', resourceName: 'nodes', name: 'my-node' })
  })

  it('parses core namespaced detail (v1/pods/default/my-pod)', () => {
    const result = parseResourcePath('v1/pods/default/my-pod')
    expect(result).toEqual({
      type: 'detail', group: '', version: 'v1', resourceName: 'pods',
      namespace: 'default', name: 'my-pod',
    })
  })

  it('parses group non-namespaced detail (apps/v1/deployments/my-deploy)', () => {
    const result = parseResourcePath('apps/v1/deployments/my-deploy')
    expect(result).toEqual({
      type: 'detail', group: 'apps', version: 'v1', resourceName: 'deployments', name: 'my-deploy',
    })
  })

  it('parses group namespaced detail (apps/v1/deployments/default/my-deploy)', () => {
    const result = parseResourcePath('apps/v1/deployments/default/my-deploy')
    expect(result).toEqual({
      type: 'detail', group: 'apps', version: 'v1', resourceName: 'deployments',
      namespace: 'default', name: 'my-deploy',
    })
  })

  it('returns null for invalid paths', () => {
    expect(parseResourcePath('')).toBeNull()
    expect(parseResourcePath('v1')).toBeNull()
    expect(parseResourcePath('a/b/c/d/e/f')).toBeNull()
  })

  it('handles leading/trailing slashes', () => {
    const result = parseResourcePath('/v1/pods/')
    expect(result).toEqual({ type: 'list', group: '', version: 'v1', resourceName: 'pods' })
  })
})
