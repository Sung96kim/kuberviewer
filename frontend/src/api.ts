import type { ContextInfo, ResourceDefinition, ResourceGroup } from '#/types'

const BASE_URL = '/api'
const REQUEST_TIMEOUT_MS = 30_000
let _loginWindowOpened = 0

export class ApiError extends Error {
  status: number
  reason: string
  detail: string

  constructor(status: number, body: string) {
    let reason = 'Error'
    let detail = body

    try {
      const parsed = JSON.parse(body)
      const k8s = parsed?.detail
      if (k8s?.message) {
        detail = k8s.message
        reason = k8s.reason ?? `HTTP ${status}`
      }
    } catch {
      // not JSON
    }

    super(detail)
    this.status = status
    this.reason = reason
    this.detail = detail
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const headers: Record<string, string> = { ...options?.headers as Record<string, string> }
    if (options?.body) {
      headers['Content-Type'] = 'application/json'
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error')
      if (res.status === 401) {
        try {
          const parsed = JSON.parse(text)
          if (parsed.error === 'oidc_auth_required' && parsed.login_url) {
            const now = Date.now()
            if (now - _loginWindowOpened > 5_000) {
              _loginWindowOpened = now
              window.open(parsed.login_url, '_blank')
            }
          }
        } catch {
          // not JSON
        }
      }
      throw new ApiError(res.status, text)
    }
    return res.json() as Promise<T>
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS / 1000}s: ${path}`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
  )
  return new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString()
}

export type ClusterHealthResponse = {
  nodes: { total: number; ready: number }
  pods: { total: number; running: number; failed: number; pending: number; issues: Record<string, number> }
  deployments: { total: number; ready: number }
  namespaces: number
  services: number
}

export type NodeMetricItem = {
  metadata: { name: string }
  usage: { cpu: string; memory: string }
}

export type PodMetricItem = {
  metadata: { name: string; namespace: string }
  containers: Array<{
    name: string
    usage: { cpu: string; memory: string }
  }>
}

export type MetricsResponse<T> = {
  available: boolean
  items?: T[]
}

export type SingleNodeMetricsResponse = {
  available: boolean
  usage?: { cpu: string; memory: string }
}

export type PrometheusStatusResponse = {
  available: boolean
  url?: string
  error?: string
}

export type PrometheusMetric = {
  metric: Record<string, string>
  values?: [number, string][]
  value?: [number, string]
}

export type PrometheusQueryResponse = {
  status: string
  data: {
    resultType: string
    result: PrometheusMetric[]
  }
}

export const api = {
  clusterHealth: () =>
    request<ClusterHealthResponse>('/cluster/health'),

  getContexts: () =>
    request<{ contexts: ContextInfo[]; current: string }>('/contexts'),

  switchContext: (name: string) =>
    request<{ current: string }>('/contexts/switch', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  discoverResources: () =>
    request<{ resources: ResourceDefinition[]; groups: ResourceGroup[] }>(
      '/resources/discover',
    ),

  listResources: (params: {
    group: string
    version: string
    name: string
    namespaced: boolean
    namespace?: string
    labelSelector?: string
    fieldSelector?: string
    limit?: number
    continueToken?: string
  }) => {
    const qs = toQueryString(params)
    return request<Record<string, unknown>>(`/resources/list?${qs}`)
  },

  getResource: (params: {
    group: string
    version: string
    name: string
    namespaced: boolean
    namespace?: string
    resourceName: string
  }) => {
    const qs = toQueryString(params)
    return request<Record<string, unknown>>(`/resources/get?${qs}`)
  },

  deleteResource: (params: {
    group: string
    version: string
    name: string
    namespaced: boolean
    namespace?: string
    resourceName: string
  }) => {
    const qs = toQueryString(params)
    return request<Record<string, unknown>>(`/resources/delete?${qs}`)
  },

  applyResource: (body: {
    group: string
    version: string
    name: string
    namespaced: boolean
    namespace?: string
    resourceName?: string
    body: unknown
  }) =>
    request<Record<string, unknown>>('/resources/apply', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  nodeMetrics: () =>
    request<MetricsResponse<NodeMetricItem>>('/metrics/nodes'),

  nodeMetricsByName: (name: string) =>
    request<SingleNodeMetricsResponse>(`/metrics/nodes/${encodeURIComponent(name)}`),

  podMetrics: (namespace?: string) => {
    const qs = namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
    return request<MetricsResponse<PodMetricItem>>(`/metrics/pods${qs}`)
  },

  patchResource: (body: {
    group: string
    version: string
    name: string
    namespaced: boolean
    namespace?: string
    resourceName?: string
    body: unknown
  }) =>
    request<Record<string, unknown>>('/resources/patch', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  scaleResource: (body: {
    group: string
    version: string
    name: string
    namespaced: boolean
    namespace?: string
    resourceName?: string
    replicas: number
  }) =>
    request<Record<string, unknown>>('/resources/scale', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  prometheusStatus: () =>
    request<PrometheusStatusResponse>('/prometheus/status'),

  prometheusQueryRange: (params: {
    query: string
    start: number
    end: number
    step?: string
  }) =>
    request<PrometheusQueryResponse>('/prometheus/query_range', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  prometheusQuery: (params: { query: string }) =>
    request<PrometheusQueryResponse>('/prometheus/query', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
}
