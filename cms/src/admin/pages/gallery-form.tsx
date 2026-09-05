import { useNavigate, useParams } from '@tanstack/react-router';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  GripVertical,
  ImageIcon,
  Plus,
  Save,
  Send,
  Trash,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import slugify from 'slugify';
import { toast } from 'sonner';

import { MediaPicker, type MediaPickerSelection } from '~/admin/components/media-picker';
import { PageHeader } from '~/admin/components/page-header';
import { Badge } from '~/admin/components/ui/badge';
import { Button } from '~/admin/components/ui/button';
import { Card, CardContent, CardHeader } from '~/admin/components/ui/card';
import { Input } from '~/admin/components/ui/input';
import { Label } from '~/admin/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/admin/components/ui/select';
import { Textarea } from '~/admin/components/ui/textarea';
import { useCategories } from '~/admin/hooks/use-categories';
import {
  useCreateGallery,
  useGallery,
  usePublishGallery,
  useUnpublishGallery,
  useUpdateGallery,
} from '~/admin/hooks/use-galleries';
import { useMedia } from '~/admin/hooks/use-media';
import { cn } from '~/admin/lib/utils';

export function GalleryFormPage() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const { data: gallery, isLoading: galleryLoading } = useGallery(id || '');
  const { data: categoriesData } = useCategories();
  const { data: mediaData } = useMedia();

  const createGallery = useCreateGallery();
  const updateGallery = useUpdateGallery();
  const publishGallery = usePublishGallery();
  const unpublishGallery = useUnpublishGallery();

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    status: 'draft',
    categoryId: 'none',
    images: [] as Array<{ id: string; mediaId: string; order: number }>,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Build media lookup map
  const mediaMap =
    mediaData?.data.reduce(
      (acc, media) => {
        acc[media.id] = media;
        return acc;
      },
      {} as Record<string, (typeof mediaData.data)[0]>
    ) || {};

  useEffect(() => {
    if (gallery) {
      setFormData({
        title: gallery.title || '',
        slug: gallery.slug || '',
        description: gallery.description || '',
        status: gallery.status || 'draft',
        categoryId: gallery.category_id || 'none',
        images:
          gallery.images?.map((img) => ({
            id: img.id,
            mediaId: img.mediaId,
            order: img.order,
          })) || [],
      });
    }
  }, [gallery]);

  const clearError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const rest = { ...prev };
        delete rest[field];
        return rest;
      });
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData((prev) => ({
      ...prev,
      title,
      slug: isNew ? slugify(title, { lower: true, strict: true }) : prev.slug,
    }));
    clearError('title');
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors['title'] = 'Title is required';
    }

    if (!formData.slug.trim()) {
      errors['slug'] = 'Slug is required';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
      errors['slug'] = 'Slug must contain only lowercase letters, numbers, and hyphens';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSave = (publish: boolean = false) => {
    if (!validateForm()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    // Convert "none" to empty string for API (which will be sent as null)
    const data = {
      ...formData,
      status: publish ? 'published' : formData.status,
      categoryId: formData.categoryId === 'none' ? '' : formData.categoryId,
    };

    if (isNew) {
      createGallery.mutate(data, {
        onSuccess: (newGallery) => {
          toast.success('Gallery created');
          const goToEdit = () => navigate({ to: `/admin/galleries/${newGallery.id}/edit` });
          if (publish) {
            publishGallery.mutate(newGallery.id, {
              onSuccess: () => {
                toast.success('Gallery published');
                goToEdit();
              },
              onError: (err: Error) => {
                toast.error(err.message);
                goToEdit();
              },
            });
          } else {
            goToEdit();
          }
        },
        onError: (err) => toast.error(err.message),
      });
    } else {
      updateGallery.mutate(
        { id: id!, data },
        {
          onSuccess: (updated) => {
            toast.success('Gallery updated');
            // Sync form state from the mutation response so the status badge
            // and image order reflect what was actually saved
            setFormData((prev) => ({
              ...prev,
              status: updated.status || prev.status,
              images:
                updated.images?.map((img) => ({
                  id: img.id,
                  mediaId: img.mediaId,
                  order: img.order,
                })) ?? prev.images,
            }));
            if (publish && updated.status !== 'published') {
              publishGallery.mutate(id!, {
                onSuccess: () => {
                  toast.success('Gallery published');
                  setFormData((prev) => ({ ...prev, status: 'published' }));
                },
                onError: (err) => toast.error(err.message),
              });
            }
          },
          onError: (err) => toast.error(err.message),
        }
      );
    }
  };

  const handleUnpublish = () => {
    if (isNew) return;
    unpublishGallery.mutate(id!, {
      onSuccess: () => {
        toast.success('Gallery unpublished');
        setFormData((prev) => ({ ...prev, status: 'draft' }));
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const addImages = (mediaItems: MediaPickerSelection[]) => {
    // Compute added/skipped from current state before updating — firing toasts
    // inside the setState updater would double-fire under React StrictMode
    const existing = new Set(formData.images.map((img) => img.mediaId));
    const toAdd = mediaItems.filter((media) => !existing.has(media.id));
    const skipped = mediaItems.length - toAdd.length;

    if (skipped > 0) {
      toast.info(
        skipped === 1
          ? '1 image was already in the gallery'
          : `${skipped} images were already in the gallery`
      );
    }
    if (toAdd.length > 0) {
      toast.success(toAdd.length === 1 ? 'Added 1 image' : `Added ${toAdd.length} images`);
      setFormData((prev) => {
        const newImages = [...prev.images];
        for (const media of toAdd) {
          newImages.push({
            id: crypto.randomUUID(),
            mediaId: media.id,
            order: newImages.length,
          });
        }
        return { ...prev, images: newImages };
      });
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => {
      const newImages = prev.images.filter((_, i) => i !== index);
      // Reorder remaining images
      return {
        ...prev,
        images: newImages.map((img, i) => ({ ...img, order: i })),
      };
    });
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === formData.images.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;

    setFormData((prev) => {
      const newImages = [...prev.images];
      const currentImage = newImages[index];
      const targetImage = newImages[newIndex];

      if (!currentImage || !targetImage) return prev;

      newImages[index] = targetImage;
      newImages[newIndex] = currentImage;

      // Update order property
      return {
        ...prev,
        images: newImages.map((img, i) => ({ ...img, order: i })),
      };
    });
  };

  const reorderImages = (from: number, to: number) => {
    if (from === to) return;
    setFormData((prev) => {
      const newImages = [...prev.images];
      const [moved] = newImages.splice(from, 1);
      if (!moved) return prev;
      newImages.splice(to, 0, moved);
      return {
        ...prev,
        images: newImages.map((img, i) => ({ ...img, order: i })),
      };
    });
  };

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex !== null) {
      reorderImages(dragIndex, index);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const getImageUrl = (mediaId: string): string | undefined => {
    const media = mediaMap[mediaId];
    if (!media?.urls) return undefined;
    return media.urls.small || media.urls.thumbnail || media.urls.original;
  };

  if (galleryLoading && !isNew) return <div>Loading...</div>;

  const isSaving = createGallery.isPending || updateGallery.isPending || publishGallery.isPending;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/admin/galleries' })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Galleries
        </Button>
        <div className="flex items-center gap-2">
          {!isNew && formData.status === 'published' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnpublish}
              disabled={unpublishGallery.isPending}
            >
              Unpublish
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onSave(false)} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button size="sm" onClick={() => onSave(true)} disabled={isSaving}>
            <Send className="mr-2 h-4 w-4" />
            {formData.status === 'published' ? 'Update' : 'Publish'}
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
                {formErrors['title'] && (
                  <p className="text-sm text-destructive mt-1">{formErrors['title']}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, slug: e.target.value }));
                    clearError('slug');
                  }}
                  placeholder="gallery-slug"
                />
                {formErrors['slug'] && (
                  <p className="text-sm text-destructive mt-1">{formErrors['slug']}</p>
                )}
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
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, categoryId: value }))}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categoriesData?.data.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={formData.status === 'published' ? 'default' : 'secondary'}>
                {formData.status}
              </Badge>
              <span className="text-sm text-muted-foreground">{formData.images.length} images</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="text-lg font-semibold">Images ({formData.images.length})</h3>
            <MediaPicker
              multiple
              onSelect={(media) => addImages([media])}
              onSelectMultiple={addImages}
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
                const imageUrl = getImageUrl(img.mediaId);
                const media = mediaMap[img.mediaId];

                return (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={handleDragStart(index)}
                    onDragOver={handleDragOver(index)}
                    onDrop={handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'group relative aspect-square overflow-hidden rounded-md border bg-muted cursor-grab active:cursor-grabbing',
                      dragOverIndex === index && dragIndex !== null && dragIndex !== index
                        ? 'border-primary ring-2 ring-primary'
                        : '',
                      dragIndex === index ? 'opacity-50' : ''
                    )}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={media?.alt || media?.filename || 'Gallery image'}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center">
                        <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground">
                          ID: {img.mediaId.slice(0, 6)}...
                        </span>
                      </div>
                    )}

                    {/* Hover overlay with controls */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      {/* Order number */}
                      <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        {index + 1}
                      </div>

                      {/* Drag handle hint */}
                      <div className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white">
                        <GripVertical className="h-3 w-3" />
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
                );
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
  );
}
