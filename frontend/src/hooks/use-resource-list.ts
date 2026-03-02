import { useQuery } from '@tanstack/react-query'
import { api } from '#/api'

type ResourceListParams = {
  group: string
  version: string
  name: string
  namespaced: boolean
  namespace?: string
  limit?: number
  labelSelector?: string
  fieldSelector?: string
  continueToken?: string
}

export function useResourceList(params: ResourceListParams) {
  return useQuery({
    queryKey: ['resources', params.group, params.version, params.name, params.namespace, params.limit],
    queryFn: () => api.listResources(params),
    refetchInterval: 10_000,
    structuralSharing: false,
  })
}
