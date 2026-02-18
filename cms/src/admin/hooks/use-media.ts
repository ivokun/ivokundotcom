import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '~/admin/api'
import { queryClient } from '~/admin/lib/query-client'

export function useMedia() {
  return useQuery({
    queryKey: ['media'],
    queryFn: api.media.list,
  })
}

export function useUploadMedia() {
  return useMutation({
    mutationFn: ({ file, alt }: { file: File; alt?: string }) =>
      api.media.upload(file, alt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
    },
  })
}

export function useUpdateMedia() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.media.update>[1] }) =>
      api.media.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
    },
  })
}

export function useDeleteMedia() {
  return useMutation({
    mutationFn: api.media.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
    },
  })
}
