import { useQuery } from '@tanstack/react-query'
import { api } from '#/api'
import { usePollingInterval } from '#/hooks/use-polling'

export function useNodeMetrics() {
  const interval = usePollingInterval(30_000)
  return useQuery({
    queryKey: ['metrics', 'nodes'],
    queryFn: () => api.nodeMetrics(),
    staleTime: 30_000,
    refetchInterval: interval,
  })
}

export function useNodeMetricsByName(name: string) {
  const interval = usePollingInterval(30_000)
  return useQuery({
    queryKey: ['metrics', 'nodes', name],
    queryFn: () => api.nodeMetricsByName(name),
    staleTime: 30_000,
    refetchInterval: interval,
    enabled: !!name,
  })
}

export function usePodMetrics(namespace?: string) {
  const interval = usePollingInterval(30_000)
  return useQuery({
    queryKey: ['metrics', 'pods', namespace],
    queryFn: () => api.podMetrics(namespace),
    staleTime: 30_000,
    refetchInterval: interval,
  })
}
