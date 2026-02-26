import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowDown, ArrowLeft, ArrowUp, ImageIcon,Plus, Save, Send, Trash, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import slugify from 'slugify'
import { toast } from 'sonner'

import { MediaPicker } from '~/admin/components/media-picker'
import { PageHeader } from '~/admin/components/page-header'
import { Badge } from '~/admin/components/ui/badge'
import { Button } from '~/admin/components/ui/button'
import { Card, CardContent } from '~/admin/components/ui/card'
import { Input } from '~/admin/components/ui/input'
import { Label } from '~/admin/components/ui/label'
import { Textarea } from '~/admin/components/ui/textarea'
import {
  useCreateGallery,
  useGallery,
  usePublishGallery,
  useUnpublishGallery,
  useUpdateGallery,
} from '~/admin/hooks/use-galleries'
import { useMedia } from '~/admin/hooks/use-media'
import { cn } from '~/admin/lib/utils'

export function GalleryFormPage() {
  const { id } = useParams({ strict: false }) as { id?: string }
  const isNew = !id || id === 'new'
  const navigate = useNavigate()

  const { data: gallery, isLoading: galleryLoading } = useGallery(id || '')
  const { data: mediaData } = useMedia()

  const createGallery = useCreateGallery()
  const updateGallery = useUpdateGallery()
  const publishGallery = usePublishGallery()
  const unpublishGallery = useUnpublishGallery()

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    status: 'draft',
    images: [] as Array<{ id: string; mediaId: string; order: number }>,
  })

  // Build media lookup map
  const mediaMap =
    mediaData?.data.reduce(
      (acc, media) => {
        acc[media.id] = media
        return acc
      },
      {} as Record<string, (typeof mediaData.data)[0]>
    ) || {}

  useEffect(() => {
    if (gallery) {
      setFormData({
        title: gallery.title || '',
        slug: gallery.slug || '',
        description: gallery.description || '',
        status: gallery.status || 'draft',
        images:
          gallery.images?.map((img: any) => ({
            id: img.id,
            mediaId: img.mediaId,
            order: img.order,
          })) || [],
      })
    }
  }, [gallery])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    setFormData((prev) => ({
      ...prev,
      title,
      slug: isNew ? slugify(title, { lower: true, strict: true }) : prev.slug,
    }))
  }

  const onSave = (publish: boolean = false) => {
    const data = { ...formData, status: publish ? 'published' : formData.status }

    if (isNew) {
      createGallery.mutate(data, {
        onSuccess: (newGallery: any) => {
          toast.success('Gallery created')
          if (publish) {
            publishGallery.mutate(newGallery.id, {
              onSuccess: () => toast.success('Gallery published'),
              onError: (err: Error) => toast.error(err.message),
            })
          }
          navigate({ to: `/admin/galleries/${newGallery.id}/edit` })
        },
        onError: (err) => toast.error(err.message),
      })
    } else {
      updateGallery.mutate(
        { id: id!, data },
        {
          onSuccess: () => {
            toast.success('Gallery updated')
            if (publish && gallery?.status !== 'published') {
              handlePublish()
            }
          },
          onError: (err) => toast.error(err.message),
        }
      )
    }
  }

  const handlePublish = () => {
    if (isNew) return
    publishGallery.mutate(id!, {
      onSuccess: () => toast.success('Gallery published'),
      onError: (err) => toast.error(err.message),
    })
  }

  const handleUnpublish = () => {
    if (isNew) return
    unpublishGallery.mutate(id!, {
      onSuccess: () => toast.success('Gallery unpublished'),
      onError: (err) => toast.error(err.message),
    })
  }

  const addImage = (media: { id: string; filename: string }) => {
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, { id: crypto.randomUUID(), mediaId: media.id, order: prev.images.length }],
    }))
  }

  const removeImage = (index: number) => {
    setFormData((prev) => {
      const newImages = prev.images.filter((_, i) => i !== index)
      // Reorder remaining images
      return {
        ...prev,
        images: newImages.map((img, i) => ({ ...img, order: i })),
      }
    })
  }

  const moveImage = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === formData.images.length - 1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1

    setFormData((prev) => {
      const newImages = [...prev.images]
      const currentImage = newImages[index]
      const targetImage = newImages[newIndex]
      
      if (!currentImage || !targetImage) return prev
      
      newImages[index] = targetImage
      newImages[newIndex] = currentImage

      // Update order property
      return {
        ...prev,
        images: newImages.map((img, i) => ({ ...img, order: i })),
      }
    })
  }

  const getImageUrl = (mediaId: string): string | undefined => {
    const media = mediaMap[mediaId]
    if (!media?.urls) return undefined
    return media.urls.small || media.urls.thumbnail || media.urls.original
  }

  if (galleryLoading && !isNew) return <div>Loading...</div>

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/admin/galleries' })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Galleries
        </Button>
        <div className="flex items-center gap-2">
          {!isNew && gallery?.status === 'published' && (
            <Button variant="outline" size="sm" onClick={handleUnpublish} disabled={unpublishGallery.isPending}>
              Unpublish
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSave(false)}
            disabled={createGallery.isPending || updateGallery.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(true)}
            disabled={createGallery.isPending || updateGallery.isPending}
          >
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
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={handleTitleChange}
                  placeholder="Gallery title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="gallery-slug"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional gallery description"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={formData.status === 'published' ? 'default' : 'secondary'}>{formData.status}</Badge>
              <span className="text-sm text-muted-foreground">{formData.images.length} images</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="text-lg font-semibold">Images ({formData.images.length})</h3>
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
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
              {formData.images.map((img, index) => {
                const imageUrl = getImageUrl(img.mediaId)
                const media = mediaMap[img.mediaId]

                return (
                  <div
                    key={img.id}
                    className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={media?.alt || media?.filename || 'Gallery image'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center">
                        <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground">ID: {img.mediaId.slice(0, 6)}...</span>
                      </div>
                    )}

                    {/* Hover overlay with controls */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      {/* Order number */}
                      <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        {index + 1}
                      </div>

                      {/* Reorder buttons */}
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveImage(index, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveImage(index, 'down')}
                          disabled={index === formData.images.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Delete button */}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeImage(index)}
                      >
                        <Trash className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
              {!formData.images.length && (
                <div className="col-span-full rounded-md border-2 border-dashed py-10 text-center text-muted-foreground">
                  No images in this gallery yet. Click "Add Images" to get started.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-between p-6', className)}>{children}</div>
}
