import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/api'

export function useContexts() {
  return useQuery({
    queryKey: ['contexts'],
    queryFn: () => api.getContexts(),
  })
}

export function useSwitchContext() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.switchContext(name),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}
