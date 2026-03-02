import { useQuery } from '@tanstack/react-query'
import { api } from '#/api'

export function useAPIResources() {
  return useQuery({
    queryKey: ['api-resources'],
    queryFn: () => api.discoverResources(),
    staleTime: 5 * 60 * 1000,
  })
}
