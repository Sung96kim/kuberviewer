import { useQuery } from '@tanstack/react-query'
import { getResourceFn } from '#/server/functions/resources'

type ResourceParams = {
  group: string
  version: string
  resource: string
  name: string
  namespaced: boolean
  namespace?: string
  resourceName: string
}

export function useResource(params: ResourceParams) {
  return useQuery({
    queryKey: ['resource', params.group, params.version, params.resource, params.namespace, params.resourceName],
    queryFn: () => getResourceFn({ data: params }),
    refetchInterval: 5_000,
  })
}
