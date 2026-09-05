import { Check, ImageIcon, Search, Upload } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '~/admin/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/admin/components/ui/dialog';
import { Input } from '~/admin/components/ui/input';
import { useMedia, useUploadMedia } from '~/admin/hooks/use-media';
import { queryClient } from '~/admin/lib/query-client';
import { cn, formatFileSize, getMediaUrl } from '~/admin/lib/utils';

export interface MediaPickerSelection {
  id: string;
  filename: string;
  alt: string | null;
  urls: { original: string; thumbnail: string; small: string; large: string } | null;
}

interface MediaPickerProps {
  onSelect: (media: MediaPickerSelection) => void;
  onSelectMultiple?: (media: MediaPickerSelection[]) => void;
  multiple?: boolean;
  selectedId?: string | null;
  trigger?: React.ReactNode;
}

export function MediaPicker({
  onSelect,
  onSelectMultiple,
  multiple = false,
  selectedId,
  trigger,
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MediaPickerSelection[]>([]);
  // Fetch up to the server-side page size cap (100) so the picker isn't
  // limited to the default page of 50 items
  const { data: media, isLoading } = useMedia({ page: 1, pageSize: 100 });
  const upload = useUploadMedia();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelected([]);
      setSearch('');
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      upload.mutate(
        { file },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['media'] });
          },
          onError: (err) => toast.error(err.message),
        }
      );
    }
    e.target.value = '';
  };

  const filteredMedia = (media?.data ?? []).filter((item) => {
    if (item.status !== 'ready') return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      item.filename.toLowerCase().includes(query) || (item.alt ?? '').toLowerCase().includes(query)
    );
  });

  const fetchedCount = media?.data.length ?? 0;
  const totalCount = media?.meta.total ?? 0;
  const hasMore = totalCount > fetchedCount;

  const handleItemClick = (item: MediaPickerSelection) => {
    if (multiple) {
      setSelected((prev) =>
        prev.some((s) => s.id === item.id) ? prev.filter((s) => s.id !== item.id) : [...prev, item]
      );
      return;
    }
    onSelect(item);
    handleOpenChange(false);
  };

  const handleConfirmMultiple = () => {
    if (selected.length === 0) return;
    onSelectMultiple?.(selected);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
          <div className="flex items-center justify-between gap-4">
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

        <div className="mt-2 flex items-center gap-2 rounded-md border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Search by filename or alt text..."
            className="h-9 border-none bg-transparent shadow-none focus-visible:ring-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto mt-4">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">Loading...</div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              No media found
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredMedia.map((item) => {
                const selectedIndex = selected.findIndex((s) => s.id === item.id);
                const isSelected = multiple ? selectedIndex !== -1 : selectedId === item.id;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'relative aspect-square cursor-pointer overflow-hidden rounded-md border-2 transition-all group',
                      isSelected
                        ? 'border-primary'
                        : 'border-transparent hover:border-muted-foreground'
                    )}
                    onClick={() => handleItemClick(item)}
                  >
                    <img
                      src={getMediaUrl(item)}
                      alt={item.alt || ''}
                      className="h-full w-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <div className="rounded-full bg-primary p-1 text-primary-foreground">
                          {multiple ? (
                            <span className="flex h-4 w-4 items-center justify-center text-[10px] font-semibold">
                              {selectedIndex + 1}
                            </span>
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="truncate text-[10px] text-white text-center">
                        {item.width && item.height ? `${item.width} × ${item.height} • ` : ''}
                        {formatFileSize(item.size)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {hasMore && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing first {fetchedCount} of {totalCount} items — use the Media Library page to
            browse the full collection.
          </p>
        )}

        <DialogFooter>
          {multiple && (
            <Button onClick={handleConfirmMultiple} disabled={selected.length === 0}>
              Add {selected.length} selected
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
