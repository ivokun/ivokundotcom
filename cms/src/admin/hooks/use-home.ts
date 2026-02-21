import { useMutation,useQuery } from '@tanstack/react-query'

import { api } from '~/admin/api'
import { queryClient } from '~/admin/lib/query-client'

export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: api.home.get,
  })
}

export function useUpdateHome() {
  return useMutation({
    mutationFn: api.home.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home'] })
    },
  })
}
