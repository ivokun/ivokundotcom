import { useMutation, useQuery } from '@tanstack/react-query'

import { api } from '~/admin/api'
import { queryClient } from '~/admin/lib/query-client'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: api.users.list,
  })
}

export function useInviteUser() {
  return useMutation({
    mutationFn: api.users.invite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useDeleteUser() {
  return useMutation({
    mutationFn: api.users.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
