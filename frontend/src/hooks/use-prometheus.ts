import { useQuery } from '@tanstack/react-query'
import { api } from '#/api'
import type { PrometheusQueryResponse } from '#/api'

export function usePrometheusStatus() {
  return useQuery({
    queryKey: ['prometheus', 'status'],
    queryFn: api.prometheusStatus,
    staleTime: 60_000,
    retry: false,
  })
}

type TimeRange = '15m' | '1h' | '6h' | '24h' | '7d'

const TIME_RANGE_SECONDS: Record<TimeRange, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
}

const TIME_RANGE_STEP: Record<TimeRange, string> = {
  '15m': '15s',
  '1h': '60s',
  '6h': '300s',
  '24h': '900s',
  '7d': '3600s',
}

function usePromRangeQuery(
  queryKey: string[],
  promql: string,
  timeRange: TimeRange,
  enabled: boolean,
) {
  const now = Math.floor(Date.now() / 1000)
  const start = now - TIME_RANGE_SECONDS[timeRange]
  const step = TIME_RANGE_STEP[timeRange]

  return useQuery<PrometheusQueryResponse>({
    queryKey: [...queryKey, timeRange],
    queryFn: () => api.prometheusQueryRange({ query: promql, start, end: now, step }),
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

export function useCpuUsageHistory(
  namespace: string | undefined,
  pod: string | undefined,
  timeRange: TimeRange,
  enabled: boolean,
) {
  let promql: string
  if (pod) {
    promql = `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod="${pod}",container!="",container!="POD"}[5m])) by (container)`
  } else if (namespace) {
    promql = `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",container!="",container!="POD"}[5m])) by (pod)`
  } else {
    promql = `sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m])) by (namespace)`
  }

  return usePromRangeQuery(
    ['prometheus', 'cpu', namespace ?? '', pod ?? ''],
    promql,
    timeRange,
    enabled,
  )
}

export function useMemoryUsageHistory(
  namespace: string | undefined,
  pod: string | undefined,
  timeRange: TimeRange,
  enabled: boolean,
) {
  let promql: string
  if (pod) {
    promql = `sum(container_memory_working_set_bytes{namespace="${namespace}",pod="${pod}",container!="",container!="POD"}) by (container)`
  } else if (namespace) {
    promql = `sum(container_memory_working_set_bytes{namespace="${namespace}",container!="",container!="POD"}) by (pod)`
  } else {
    promql = `sum(container_memory_working_set_bytes{container!="",container!="POD"}) by (namespace)`
  }

  return usePromRangeQuery(
    ['prometheus', 'memory', namespace ?? '', pod ?? ''],
    promql,
    timeRange,
    enabled,
  )
}

export function useNetworkHistory(
  namespace: string | undefined,
  pod: string | undefined,
  timeRange: TimeRange,
  enabled: boolean,
) {
  const filter = pod
    ? `namespace="${namespace}",pod="${pod}"`
    : namespace
      ? `namespace="${namespace}"`
      : ''

  const rxQuery = `sum(rate(container_network_receive_bytes_total{${filter}}[5m])) by (pod)`
  const txQuery = `sum(rate(container_network_transmit_bytes_total{${filter}}[5m])) by (pod)`

  const rx = usePromRangeQuery(
    ['prometheus', 'network-rx', namespace ?? '', pod ?? ''],
    rxQuery,
    timeRange,
    enabled,
  )

  const tx = usePromRangeQuery(
    ['prometheus', 'network-tx', namespace ?? '', pod ?? ''],
    txQuery,
    timeRange,
    enabled,
  )

  return { rx, tx }
}
