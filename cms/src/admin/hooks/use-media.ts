import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '~/admin/api'
import { queryClient } from '~/admin/lib/query-client'

export function useMedia() {
  return useQuery({
    queryKey: ['media'],
    queryFn: api.media.list,
    // Refetch periodically to pick up processing completions
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.data.some((m) => m.status === 'processing' || m.status === 'uploading')) {
        return 3000 // Poll every 3s while items are processing
      }
      return false
    },
  })
}

export function useUploadMedia() {
  const [progress, setProgress] = useState<Record<string, number>>({})

  const mutation = useMutation({
    mutationFn: ({ file, alt }: { file: File; alt?: string }) =>
      api.media.upload(file, alt, (pct) => {
        setProgress((prev) => ({ ...prev, [file.name]: pct }))
      }),
    onSuccess: (_, variables) => {
      setProgress((prev) => {
        const next = { ...prev }
        delete next[variables.file.name]
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['media'] })
    },
    onError: (_, variables) => {
      setProgress((prev) => {
        const next = { ...prev }
        delete next[variables.file.name]
        return next
      })
    },
  })

  return { ...mutation, progress }
}

export function useUpdateMedia() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.media.update>[1] }) =>
      api.media.update(id, data),
    onSuccess: () => {
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
