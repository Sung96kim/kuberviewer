import { useQuery } from '@tanstack/react-query'
import { api } from '#/api'

type ResourceParams = {
  group: string
  version: string
  name: string
  namespaced: boolean
  namespace?: string
  resourceName: string
}

export function useResource(params: ResourceParams) {
  return useQuery({
    queryKey: ['resource', params.group, params.version, params.name, params.namespace, params.resourceName],
    queryFn: () => api.getResource(params),
    refetchInterval: 15_000,
  })
}
