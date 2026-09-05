import { Link } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  FileEdit,
  Image as ImageIcon,
  MoreHorizontal,
  Plus,
  Trash,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '~/admin/components/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/admin/components/ui/alert-dialog';
import { Badge } from '~/admin/components/ui/badge';
import { Button } from '~/admin/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/admin/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/admin/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/admin/components/ui/select';
import { useDeleteGallery, useGalleries } from '~/admin/hooks/use-galleries';
import { formatDate } from '~/admin/lib/utils';

const PAGE_SIZE = 12;

export function GalleriesListPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: galleries, isLoading } = useGalleries({
    page,
    pageSize: PAGE_SIZE,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const deleteGallery = useDeleteGallery();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      deleteGallery.mutate(deleteId, {
        onSuccess: () => {
          toast.success('Gallery deleted');
          setDeleteId(null);
        },
        onError: (err) => toast.error(err.message),
      });
    }
  };

  const total = galleries?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader title="Galleries" description="Manage your photo galleries">
        <Button asChild>
          <Link to="/admin/galleries/new">
            <Plus className="mr-2 h-4 w-4" />
            New Gallery
          </Link>
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          <p className="col-span-full py-10 text-center text-muted-foreground">
            Loading galleries...
          </p>
        ) : galleries?.data.length ? (
          galleries.data.map((gallery) => (
            <Card key={gallery.id} className="flex flex-col overflow-hidden">
              <div className="aspect-video flex items-center justify-center border-b bg-muted">
                {gallery.cover_url ? (
                  <img
                    src={gallery.cover_url}
                    alt={gallery.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                )}
              </div>
              <CardHeader className="space-y-1 p-4">
                <div className="flex items-center justify-between">
                  <Badge variant={gallery.status === 'published' ? 'default' : 'secondary'}>
                    {gallery.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {gallery.image_count} images
                  </span>
                </div>
                <CardTitle className="truncate text-lg">{gallery.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-4 pt-0">
                <p className="text-xs text-muted-foreground">
                  Created {formatDate(gallery.created_at)}
                </p>
              </CardContent>
              <CardFooter className="flex gap-2 p-4 pt-0">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link to="/admin/galleries/$id/edit" params={{ id: gallery.id }}>
                    <FileEdit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(gallery.id)}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardFooter>
            </Card>
          ))
        ) : (
          <p className="col-span-full py-10 text-center text-muted-foreground">
            No galleries found
          </p>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{total} galleries</p>
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

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the gallery and remove all
              associated images from it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Gallery
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
