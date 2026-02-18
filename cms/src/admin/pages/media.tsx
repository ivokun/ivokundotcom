import { useState } from 'react'
import { PageHeader } from '~/admin/components/page-header'
import { Button } from '~/admin/components/ui/button'
import { Upload, Trash, Search, Copy, Check, Filter } from 'lucide-react'
import { useMedia, useUploadMedia, useDeleteMedia, useUpdateMedia } from '~/admin/hooks/use-media'
import { Card, CardContent } from '~/admin/components/ui/card'
import { Input } from '~/admin/components/ui/input'
import { cn, formatFileSize, formatDate, getMediaUrl } from '~/admin/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '~/admin/components/ui/dialog'
import { Label } from '~/admin/components/ui/label'
import { toast } from 'sonner'

export function MediaLibraryPage() {
  const { data: media, isLoading } = useMedia()
  const upload = useUploadMedia()
  const deleteMedia = useDeleteMedia()
  const updateMedia = useUpdateMedia()

  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      upload.mutate({ file }, {
        onSuccess: () => toast.success(`Uploaded ${file.name}`),
        onError: (err) => toast.error(`Failed to upload ${file.name}: ${err.message}`)
      })
    })
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
    const formData = new FormData(e.currentTarget)
    const alt = formData.get('alt') as string
    updateMedia.mutate({ id: selectedItem.id, data: { alt } }, {
      onSuccess: () => {
        toast.success('Updated alt text')
        setSelectedItem((prev: any) => ({ ...prev, alt }))
      },
      onError: (err) => toast.error(err.message)
    })
  }

  const copyUrl = (item: { id: string; filename: string }) => {
    const url = `${window.location.origin}${getMediaUrl(item)}`
    navigator.clipboard.writeText(url)
    setCopiedId(item.id)
    toast.success('URL copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredMedia = media?.data.filter(item => 
    item.filename.toLowerCase().includes(search.toLowerCase()) || 
    item.alt?.toLowerCase().includes(search.toLowerCase())
  )

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
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Media
          </Button>
        </div>
      </PageHeader>

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
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border bg-muted transition-all hover:border-primary"
              onClick={() => setSelectedItem(item)}
            >
              <img 
                src={getMediaUrl(item)}
                alt={item.alt || ''} 
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
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
                <img 
                  src={getMediaUrl(selectedItem)}
                  alt={selectedItem.alt || ''} 
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="font-semibold">{selectedItem.filename}</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedItem.mimeType} • {formatFileSize(selectedItem.size)}
                  </p>
                  <p className="text-xs text-muted-foreground">Uploaded on {formatDate(selectedItem.createdAt)}</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => copyUrl(selectedItem)}>
                    {copiedId === selectedItem.id ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    Copy URL
                  </Button>
                </div>

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
