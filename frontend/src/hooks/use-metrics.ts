import { useQuery } from '@tanstack/react-query'
import { api } from '#/api'

export function useNodeMetrics() {
  return useQuery({
    queryKey: ['metrics', 'nodes'],
    queryFn: () => api.nodeMetrics(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

export function useNodeMetricsByName(name: string) {
  return useQuery({
    queryKey: ['metrics', 'nodes', name],
    queryFn: () => api.nodeMetricsByName(name),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: !!name,
  })
}

export function usePodMetrics(namespace?: string) {
  return useQuery({
    queryKey: ['metrics', 'pods', namespace],
    queryFn: () => api.podMetrics(namespace),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
