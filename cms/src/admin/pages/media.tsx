import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Search,
  Trash,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { MediaStatusParam } from '~/admin/api';
import { PageHeader } from '~/admin/components/page-header';
import { Badge } from '~/admin/components/ui/badge';
import { Button } from '~/admin/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/admin/components/ui/dialog';
import { Input } from '~/admin/components/ui/input';
import { Label } from '~/admin/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/admin/components/ui/select';
import { useDeleteMedia, useMedia, useUpdateMedia, useUploadMedia } from '~/admin/hooks/use-media';
import { cn, formatDate, formatFileSize } from '~/admin/lib/utils';

const PAGE_SIZE = 24;

type MediaItem = {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  alt: string | null;
  urls: { original: string; thumbnail: string; small: string; large: string } | null;
  width: number | null;
  height: number | null;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  created_at: string;
};

function getMediaThumbnailUrl(item: MediaItem): string | undefined {
  if (!item.urls) return undefined;
  return item.urls.thumbnail || item.urls.small || item.urls.original;
}

function getMediaFullUrl(item: MediaItem): string | undefined {
  if (!item.urls) return undefined;
  return item.urls.original;
}

function formatDimensions(item: MediaItem): string | null {
  if (!item.width || !item.height) return null;
  return `${item.width} × ${item.height}`;
}

export function MediaLibraryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MediaStatusParam | 'all'>('all');

  // Debounce the search input so we don't fire a request per keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: media, isLoading } = useMedia({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const { mutate: uploadMutate, progress, isPending: isUploading } = useUploadMedia();
  const deleteMedia = useDeleteMedia();
  const updateMedia = useUpdateMedia();
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [altValue, setAltValue] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFiles = (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (images.length < files.length) {
      toast.info('Only image files can be uploaded');
    }
    images.forEach((file) => {
      uploadMutate(
        { file },
        {
          onSuccess: () => toast.success(`Uploaded ${file.name}`),
          onError: (err) => toast.error(`Failed to upload ${file.name}: ${err.message}`),
        }
      );
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(Array.from(e.target.files || []));
    // Reset input
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  const handleDelete = () => {
    if (selectedItem) {
      deleteMedia.mutate(selectedItem.id, {
        onSuccess: () => {
          toast.success('Media deleted');
          setSelectedItem(null);
        },
        onError: (err) => toast.error(err.message),
      });
    }
  };

  const handleUpdateAlt = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedItem) return;
    const alt = altValue;
    updateMedia.mutate(
      { id: selectedItem.id, data: { alt } },
      {
        onSuccess: () => {
          toast.success('Updated alt text');
          setSelectedItem((prev) => (prev ? { ...prev, alt } : prev));
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const copyUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredMedia = media?.data as MediaItem[] | undefined;

  const uploadingFiles = Object.entries(progress);
  const total = media?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Clamp the page when the result set shrinks (e.g. after a delete or a
  // narrower search) so we don't sit on an out-of-range empty page
  useEffect(() => {
    if (media && page > totalPages) {
      setPage(totalPages);
    }
  }, [media, page, totalPages]);

  const variants: Array<{ label: string; key: string; url: string | undefined }> =
    selectedItem?.status === 'ready' && selectedItem.urls
      ? [
          { label: 'Original', key: 'original', url: selectedItem.urls.original },
          { label: 'Large (1920w)', key: 'large', url: selectedItem.urls.large },
          { label: 'Small (800w)', key: 'small', url: selectedItem.urls.small },
          { label: 'Thumbnail (200w)', key: 'thumbnail', url: selectedItem.urls.thumbnail },
        ]
      : [];

  return (
    <div
      className="relative space-y-6"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/80">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-10 w-10" />
            <p className="text-lg font-medium">Drop images to upload</p>
          </div>
        </div>
      )}

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
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
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
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as MediaStatusParam | 'all');
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {isLoading ? (
          <p className="col-span-full py-10 text-center text-muted-foreground">Loading media...</p>
        ) : filteredMedia?.length ? (
          filteredMedia.map((item) => {
            const dimensions = formatDimensions(item);
            return (
              <div
                key={item.id}
                className={cn(
                  'group relative aspect-square cursor-pointer overflow-hidden rounded-lg border bg-muted transition-all hover:border-primary',
                  item.status !== 'ready' && 'opacity-70'
                )}
                onClick={() => {
                  setSelectedItem(item);
                  setAltValue(item.alt || '');
                }}
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
                    <Badge
                      variant={item.status === 'failed' ? 'destructive' : 'secondary'}
                      className="text-[10px]"
                    >
                      {item.status}
                    </Badge>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex flex-col justify-end p-2">
                  <p className="truncate text-[10px] text-white font-medium">{item.filename}</p>
                  <p className="text-[10px] text-white/80">
                    {dimensions ? `${dimensions} • ` : ''}
                    {formatFileSize(item.size)}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="col-span-full py-10 text-center text-muted-foreground">No media found</p>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{total} items</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
                    {selectedItem.status === 'processing' && (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    )}
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
                    {formatDimensions(selectedItem)
                      ? `${formatDimensions(selectedItem)} px • `
                      : ''}
                    {selectedItem.mime_type} {'•'} {formatFileSize(selectedItem.size)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Uploaded on {formatDate(selectedItem.created_at)}
                  </p>
                  <Badge
                    variant={
                      selectedItem.status === 'ready'
                        ? 'default'
                        : selectedItem.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                    }
                    className="mt-1"
                  >
                    {selectedItem.status}
                  </Badge>
                </div>

                {variants.length > 0 && (
                  <div className="space-y-2">
                    <Label>Variants</Label>
                    <div className="divide-y rounded-md border">
                      {variants.map((variant) => (
                        <div key={variant.key} className="flex items-center justify-between p-2">
                          <span className="text-sm">{variant.label}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!variant.url}
                            onClick={() =>
                              variant.url &&
                              copyUrl(variant.url, `${selectedItem.id}:${variant.key}`)
                            }
                          >
                            {copiedKey === `${selectedItem.id}:${variant.key}` ? (
                              <Check className="mr-2 h-4 w-4" />
                            ) : (
                              <Copy className="mr-2 h-4 w-4" />
                            )}
                            Copy URL
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleUpdateAlt} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="alt">Alt Text</Label>
                    <Input
                      id="alt"
                      name="alt"
                      value={altValue}
                      onChange={(e) => setAltValue(e.target.value)}
                      placeholder="Describe the image..."
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={updateMedia.isPending}>
                    {updateMedia.isPending ? 'Saving...' : 'Save Alt Text'}
                  </Button>
                </form>

                <div className="pt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={handleDelete}
                    disabled={deleteMedia.isPending}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete Media
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
