import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getContexts, switchContext } from '#/server/functions/contexts'

export function useContexts() {
  return useQuery({
    queryKey: ['contexts'],
    queryFn: () => getContexts(),
  })
}

export function useSwitchContext() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => switchContext({ data: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}
