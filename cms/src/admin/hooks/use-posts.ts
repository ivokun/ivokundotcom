import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '~/admin/api'
import { queryClient } from '~/admin/lib/query-client'

export function usePosts(filters?: Parameters<typeof api.posts.list>[0]) {
  return useQuery({
    queryKey: ['posts', filters],
    queryFn: () => api.posts.list(filters),
  })
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ['posts', id],
    queryFn: () => api.posts.get(id),
    enabled: !!id && id !== 'new',
  })
}

export function useCreatePost() {
  return useMutation({
    mutationFn: api.posts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}

export function useUpdatePost() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.posts.update>[1] }) =>
      api.posts.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['posts', variables.id] })
    },
  })
}

export function useDeletePost() {
  return useMutation({
    mutationFn: api.posts.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}

export function usePublishPost() {
  return useMutation({
    mutationFn: api.posts.publish,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['posts', id] })
    },
  })
}

export function useUnpublishPost() {
  return useMutation({
    mutationFn: api.posts.unpublish,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['posts', id] })
    },
  })
}
