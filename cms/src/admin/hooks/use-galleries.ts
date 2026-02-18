import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '~/admin/api'
import { queryClient } from '~/admin/lib/query-client'

export function useGalleries(filters?: Parameters<typeof api.galleries.list>[0]) {
  return useQuery({
    queryKey: ['galleries', filters],
    queryFn: () => api.galleries.list(filters),
  })
}

export function useGallery(id: string) {
  return useQuery({
    queryKey: ['galleries', id],
    queryFn: () => api.galleries.get(id),
    enabled: !!id && id !== 'new',
  })
}

export function useCreateGallery() {
  return useMutation({
    mutationFn: api.galleries.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
    },
  })
}

export function useUpdateGallery() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.galleries.update>[1] }) =>
      api.galleries.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
      queryClient.invalidateQueries({ queryKey: ['galleries', variables.id] })
    },
  })
}

export function useDeleteGallery() {
  return useMutation({
    mutationFn: api.galleries.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
    },
  })
}

export function usePublishGallery() {
  return useMutation({
    mutationFn: api.galleries.publish,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
      queryClient.invalidateQueries({ queryKey: ['galleries', id] })
    },
  })
}

export function useUnpublishGallery() {
  return useMutation({
    mutationFn: api.galleries.unpublish,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] })
      queryClient.invalidateQueries({ queryKey: ['galleries', id] })
    },
  })
}
