import { useMutation,useQuery } from '@tanstack/react-query'

import { api } from '~/admin/api'
import { queryClient } from '~/admin/lib/query-client'

export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.auth.getCurrentUser,
    retry: false,
    // Avoid refetching on every component mount as the user navigates between
    // pages. Session validity is enforced server-side via HttpOnly cookie;
    // there is no need to re-validate on every page transition.
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.auth.login(email, password),
    onSuccess: (data) => {
      // Pre-populate the user cache from the login response so that navigating
      // to a protected route immediately after login never shows a "Loading..."
      // flash (no extra network round-trip needed).
      queryClient.setQueryData(['auth', 'me'], data.user)
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
