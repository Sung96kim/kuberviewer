import { useQuery } from '@tanstack/react-query'
import { getAPIResources } from '#/server/functions/discovery'

export function useAPIResources() {
  return useQuery({
    queryKey: ['api-resources'],
    queryFn: () => getAPIResources(),
    staleTime: 5 * 60 * 1000,
  })
}
