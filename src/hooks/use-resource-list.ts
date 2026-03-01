import { useQuery } from '@tanstack/react-query'
import { listResourcesFn } from '#/server/functions/resources'

type ResourceListParams = {
  group: string
  version: string
  resource: string
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
    queryKey: ['resources', params.group, params.version, params.resource, params.namespace],
    queryFn: () => listResourcesFn({ data: params }),
    refetchInterval: 10_000,
  })
}
