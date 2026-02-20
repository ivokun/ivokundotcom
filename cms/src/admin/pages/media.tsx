import { useState } from 'react'
import { PageHeader } from '~/admin/components/page-header'
import { Button } from '~/admin/components/ui/button'
import { Badge } from '~/admin/components/ui/badge'
import { Upload, Trash, Search, Copy, Check, Filter, Loader2 } from 'lucide-react'
import { useMedia, useUploadMedia, useDeleteMedia, useUpdateMedia } from '~/admin/hooks/use-media'
import { Input } from '~/admin/components/ui/input'
import { cn, formatFileSize, formatDate } from '~/admin/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '~/admin/components/ui/dialog'
import { Label } from '~/admin/components/ui/label'
import { toast } from 'sonner'

type MediaItem = {
  id: string
  filename: string
  mime_type: string
  size: number
  alt: string | null
  urls: { original: string; thumbnail: string; small: string; large: string } | null
  status: 'uploading' | 'processing' | 'ready' | 'failed'
  created_at: string
}

function getMediaThumbnailUrl(item: MediaItem): string | undefined {
  if (!item.urls) return undefined
  return item.urls.thumbnail || item.urls.small || item.urls.original
}

function getMediaFullUrl(item: MediaItem): string | undefined {
  if (!item.urls) return undefined
  return item.urls.original
}

export function MediaLibraryPage() {
  const { data: media, isLoading } = useMedia()
  const { mutate: uploadMutate, progress, isPending: isUploading } = useUploadMedia()
  const deleteMedia = useDeleteMedia()
  const updateMedia = useUpdateMedia()

  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      uploadMutate({ file }, {
        onSuccess: () => toast.success(`Uploaded ${file.name}`),
        onError: (err) => toast.error(`Failed to upload ${file.name}: ${err.message}`)
      })
    })
    // Reset input
    e.target.value = ''
  }

  const handleDelete = () => {
    if (selectedItem) {
      deleteMedia.mutate(selectedItem.id, {
        onSuccess: () => {
          toast.success('Media deleted')
          setSelectedItem(null)
        },
        onError: (err) => toast.error(err.message)
      })
    }
  }

  const handleUpdateAlt = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedItem) return
    const formData = new FormData(e.currentTarget)
    const alt = formData.get('alt') as string
    updateMedia.mutate({ id: selectedItem.id, data: { alt } }, {
      onSuccess: () => {
        toast.success('Updated alt text')
        setSelectedItem((prev) => prev ? { ...prev, alt } : prev)
      },
      onError: (err) => toast.error(err.message)
    })
  }

  const copyUrl = (item: MediaItem) => {
    const url = getMediaFullUrl(item)
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopiedId(item.id)
    toast.success('URL copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredMedia = (media?.data as MediaItem[] | undefined)?.filter(item =>
    item.filename.toLowerCase().includes(search.toLowerCase()) ||
    item.alt?.toLowerCase().includes(search.toLowerCase())
  )

  const uploadingFiles = Object.entries(progress)

  return (
    <div className="space-y-6">
      <PageHeader title="Media Library" description="Upload and manage your images and files">
        <div className="relative">
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleUpload}
            multiple
            accept="image/*"
          />
          <Button disabled={isUploading}>
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload Media
          </Button>
        </div>
      </PageHeader>

      {/* Upload progress indicators */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map(([name, pct]) => (
            <div key={name} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="flex-1 truncate text-sm">{name}</span>
              <span className="text-sm font-medium text-muted-foreground">{pct}%</span>
              <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
        <div className="flex flex-1 items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search media..."
            className="h-9 border-none bg-transparent shadow-none focus-visible:ring-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="ghost" size="sm">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {isLoading ? (
          <p className="col-span-full py-10 text-center text-muted-foreground">Loading media...</p>
        ) : filteredMedia?.length ? (
          filteredMedia.map((item) => (
            <div
              key={item.id}
              className={cn(
                "group relative aspect-square cursor-pointer overflow-hidden rounded-lg border bg-muted transition-all hover:border-primary",
                item.status !== 'ready' && "opacity-70"
              )}
              onClick={() => setSelectedItem(item)}
            >
              {item.status === 'ready' && getMediaThumbnailUrl(item) ? (
                <img
                  src={getMediaThumbnailUrl(item)}
                  alt={item.alt || ''}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2">
                  {item.status === 'processing' || item.status === 'uploading' ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : null}
                  <Badge variant={item.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {item.status}
                  </Badge>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex flex-col justify-end p-2">
                <p className="truncate text-[10px] text-white font-medium">{item.filename}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="col-span-full py-10 text-center text-muted-foreground">No media found</p>
        )}
      </div>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Media Details</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="overflow-hidden rounded-md border bg-muted flex items-center justify-center aspect-square">
                {selectedItem.status === 'ready' && getMediaFullUrl(selectedItem) ? (
                  <img
                    src={getMediaFullUrl(selectedItem)}
                    alt={selectedItem.alt || ''}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {selectedItem.status === 'processing' && <Loader2 className="h-8 w-8 animate-spin" />}
                    <Badge variant={selectedItem.status === 'failed' ? 'destructive' : 'secondary'}>
                      {selectedItem.status}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="font-semibold">{selectedItem.filename}</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedItem.mime_type} {'\u2022'} {formatFileSize(selectedItem.size)}
                  </p>
                  <p className="text-xs text-muted-foreground">Uploaded on {formatDate(selectedItem.created_at)}</p>
                  <Badge variant={selectedItem.status === 'ready' ? 'default' : selectedItem.status === 'failed' ? 'destructive' : 'secondary'} className="mt-1">
                    {selectedItem.status}
                  </Badge>
                </div>

                {selectedItem.status === 'ready' && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => copyUrl(selectedItem)}>
                      {copiedId === selectedItem.id ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      Copy URL
                    </Button>
                  </div>
                )}

                <form onSubmit={handleUpdateAlt} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="alt">Alt Text</Label>
                    <Input id="alt" name="alt" defaultValue={selectedItem.alt || ''} placeholder="Describe the image..." />
                  </div>
                  <Button type="submit" size="sm" disabled={updateMedia.isPending}>
                    {updateMedia.isPending ? 'Saving...' : 'Save Alt Text'}
                  </Button>
                </form>

                <div className="pt-4">
                  <Button variant="destructive" size="sm" className="w-full" onClick={handleDelete} disabled={deleteMedia.isPending}>
                    <Trash className="mr-2 h-4 w-4" />
                    Delete Media
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
