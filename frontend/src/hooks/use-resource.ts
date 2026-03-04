import { useQuery } from '@tanstack/react-query'
import { api } from '#/api'
import { usePollingInterval } from '#/hooks/use-polling'

type ResourceParams = {
  group: string
  version: string
  name: string
  namespaced: boolean
  namespace?: string
  resourceName: string
}

export function useResource(params: ResourceParams) {
  const interval = usePollingInterval(15_000)
  return useQuery({
    queryKey: ['resource', params.group, params.version, params.name, params.namespace, params.resourceName],
    queryFn: () => api.getResource(params),
    refetchInterval: interval,
  })
}
