import { useState, useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '~/admin/components/page-header'
import { Button } from '~/admin/components/ui/button'
import { Card, CardContent } from '~/admin/components/ui/card'
import { Input } from '~/admin/components/ui/input'
import { Label } from '~/admin/components/ui/label'
import { Textarea } from '~/admin/components/ui/textarea'
import { MediaPicker } from '~/admin/components/media-picker'
import { useGallery, useCreateGallery, useUpdateGallery, usePublishGallery, useUnpublishGallery } from '~/admin/hooks/use-galleries'
import { Save, Send, ArrowLeft, Trash, GripVertical, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import slugify from 'slugify'
import { Badge } from '~/admin/components/ui/badge'

export function GalleryFormPage() {
  const { id } = useParams({ strict: false }) as { id?: string }
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  
  const { data: gallery, isLoading: galleryLoading } = useGallery(id || '')
  
  const createGallery = useCreateGallery()
  const updateGallery = useUpdateGallery()
  const publishGallery = usePublishGallery()
  const unpublishGallery = useUnpublishGallery()

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    status: 'draft',
    images: [] as Array<{ id?: string; mediaId: string; order: number }>
  })

  useEffect(() => {
    if (gallery) {
      setFormData({
        title: gallery.title || '',
        slug: gallery.slug || '',
        description: gallery.description || '',
        status: gallery.status || 'draft',
        images: gallery.images || []
      })
    }
  }, [gallery])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    setFormData(prev => ({
      ...prev,
      title,
      slug: isNew ? slugify(title, { lower: true, strict: true }) : prev.slug
    }))
  }

  const onSave = (publish: boolean = false) => {
    const data = { ...formData, status: publish ? 'published' : formData.status }
    
    if (isNew) {
      createGallery.mutate(data, {
        onSuccess: (newGallery: any) => {
          toast.success('Gallery created')
          navigate({ to: `/admin/galleries/${newGallery.id}/edit` })
        },
        onError: (err) => toast.error(err.message)
      })
    } else {
      updateGallery.mutate({ id: id!, data }, {
        onSuccess: () => {
          toast.success('Gallery updated')
          if (publish && gallery?.status !== 'published') {
            handlePublish()
          }
        },
        onError: (err) => toast.error(err.message)
      })
    }
  }

  const handlePublish = () => {
    if (isNew) return
    publishGallery.mutate(id!, {
      onSuccess: () => toast.success('Gallery published'),
      onError: (err) => toast.error(err.message)
    })
  }

  const addImage = (media: { id: string }) => {
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, { mediaId: media.id, order: prev.images.length }]
    }))
  }

  const removeImage = (mediaId: string) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter(img => img.mediaId !== mediaId)
    }))
  }

  if (galleryLoading && !isNew) return <div>Loading...</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/admin/galleries' })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Galleries
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onSave(false)} disabled={createGallery.isPending || updateGallery.isPending}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button size="sm" onClick={() => onSave(true)} disabled={createGallery.isPending || updateGallery.isPending}>
            <Send className="mr-2 h-4 w-4" />
            {gallery?.status === 'published' ? 'Update' : 'Publish'}
          </Button>
        </div>
      </div>

      <PageHeader 
        title={isNew ? 'New Gallery' : 'Edit Gallery'} 
        description={isNew ? 'Create a new collection of images' : `Editing: ${gallery?.title}`}
      />

      <div className="grid gap-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={formData.title} onChange={handleTitleChange} placeholder="Gallery title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" value={formData.slug} onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))} placeholder="gallery-slug" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Optional gallery description" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="text-lg font-semibold">Images</h3>
            <MediaPicker 
              onSelect={addImage} 
              trigger={
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Images
                </Button>
              } 
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {formData.images.map((img, index) => (
                <div key={img.mediaId} className="group relative aspect-square rounded-md border overflow-hidden bg-muted">
                  <img 
                    src={`/uploads/media-${img.mediaId}`} 
                    className="h-full w-full object-cover"
                    alt={`Gallery item ${index}`}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => removeImage(img.mediaId)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute top-1 left-1 bg-black/60 px-1 rounded text-[10px] text-white">
                    {index + 1}
                  </div>
                </div>
              ))}
              {!formData.images.length && (
                <div className="col-span-full py-10 text-center border-2 border-dashed rounded-md text-muted-foreground">
                  No images in this gallery yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CardHeader({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn("p-6 flex items-center justify-between", className)}>{children}</div>
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}
