import { useMutation,useQuery } from '@tanstack/react-query'

import { api } from '~/admin/api'
import { queryClient } from '~/admin/lib/query-client'

export function useApiKeys() {
  return useQuery({
    queryKey: ['apiKeys'],
    queryFn: api.apiKeys.list,
  })
}

export function useCreateApiKey() {
  return useMutation({
    mutationFn: api.apiKeys.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })
}

export function useDeleteApiKey() {
  return useMutation({
    mutationFn: api.apiKeys.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })
}
