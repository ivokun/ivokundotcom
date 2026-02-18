import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '~/admin/api'
import { queryClient } from '~/admin/lib/query-client'

export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.auth.getCurrentUser,
    retry: false,
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: Parameters<typeof api.auth.login>) =>
      api.auth.login(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null)
      queryClient.clear()
    },
  })
}
