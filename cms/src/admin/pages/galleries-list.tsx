import { Link } from '@tanstack/react-router'
import { FileEdit, Image as ImageIcon, MoreHorizontal, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '~/admin/components/page-header'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/admin/components/ui/alert-dialog'
import { Badge } from '~/admin/components/ui/badge'
import { Button } from '~/admin/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/admin/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/admin/components/ui/dropdown-menu'
import { useDeleteGallery, useGalleries } from '~/admin/hooks/use-galleries'
import { formatDate } from '~/admin/lib/utils'

export function GalleriesListPage() {
  const { data: galleries, isLoading } = useGalleries()
  const deleteGallery = useDeleteGallery()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleDelete = () => {
    if (deleteId) {
      deleteGallery.mutate(deleteId, {
        onSuccess: () => {
          toast.success('Gallery deleted')
          setDeleteId(null)
        },
        onError: (err) => toast.error(err.message),
      })
    }
  }

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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          <p className="col-span-full py-10 text-center text-muted-foreground">Loading galleries...</p>
        ) : galleries?.data.length ? (
          galleries.data.map((gallery) => (
            <Card key={gallery.id} className="flex flex-col overflow-hidden">
              <div className="aspect-video flex items-center justify-center border-b bg-muted">
                <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <CardHeader className="space-y-1 p-4">
                <div className="flex items-center justify-between">
                  <Badge variant={gallery.status === 'published' ? 'default' : 'secondary'}>
                    {gallery.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{gallery.imageCount} images</span>
                </div>
                <CardTitle className="truncate text-lg">{gallery.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-4 pt-0">
                <p className="text-xs text-muted-foreground">
                  Created {formatDate(gallery.createdAt || (gallery as any).created_at)}
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
          <p className="col-span-full py-10 text-center text-muted-foreground">No galleries found</p>
        )}
      </div>

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
  )
}
