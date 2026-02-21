import { useMutation,useQuery } from '@tanstack/react-query'

import { api } from '~/admin/api'
import { queryClient } from '~/admin/lib/query-client'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.list,
  })
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: ['categories', id],
    queryFn: () => api.categories.get(id),
    enabled: !!id,
  })
}

export function useCreateCategory() {
  return useMutation({
    mutationFn: api.categories.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useUpdateCategory() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.categories.update>[1] }) =>
      api.categories.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories', variables.id] })
    },
  })
}

export function useDeleteCategory() {
  return useMutation({
    mutationFn: api.categories.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}
