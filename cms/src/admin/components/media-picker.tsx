import { Check, ImageIcon,Upload } from 'lucide-react'
import React, { useState } from 'react'

import { Button } from '~/admin/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/admin/components/ui/dialog'
import { useMedia, useUploadMedia } from '~/admin/hooks/use-media'
import { cn, formatFileSize, getMediaUrl } from '~/admin/lib/utils'

interface MediaPickerProps {
  onSelect: (media: { id: string; filename: string }) => void
  selectedId?: string | null
  trigger?: React.ReactNode
}

export function MediaPicker({ onSelect, selectedId, trigger }: MediaPickerProps) {
  const [open, setOpen] = useState(false)
  const { data: media, isLoading } = useMedia()
  const upload = useUploadMedia()

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      upload.mutate({ file }, {
        onSuccess: (data: any) => {
          // data matches the expected structure
          // api.ts uploadMedia returns { id, filename, ... }
        }
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full">
            <ImageIcon className="mr-2 h-4 w-4" />
            {selectedId ? 'Change Image' : 'Select Image'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Media Library</DialogTitle>
            <div className="relative">
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleUpload}
                accept="image/*"
              />
              <Button size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {media?.data.filter((item) => (item as any).status === 'ready').map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "relative aspect-square cursor-pointer overflow-hidden rounded-md border-2 transition-all group",
                    selectedId === item.id ? "border-primary" : "border-transparent hover:border-muted-foreground"
                  )}
                  onClick={() => {
                    onSelect(item)
                    setOpen(false)
                  }}
                >
                  <img
                    src={getMediaUrl(item)}
                    alt={item.alt || ''}
                    className="h-full w-full object-cover"
                  />
                  {selectedId === item.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                      <div className="rounded-full bg-primary p-1 text-primary-foreground">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="truncate text-[10px] text-white text-center">
                      {formatFileSize(item.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
