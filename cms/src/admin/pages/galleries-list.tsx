import { PageHeader } from '~/admin/components/page-header'
import { Button } from '~/admin/components/ui/button'
import { Plus, MoreHorizontal, FileEdit, Trash, Image as ImageIcon } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useGalleries } from '~/admin/hooks/use-galleries'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '~/admin/components/ui/card'
import { Badge } from '~/admin/components/ui/badge'
import { formatDate } from '~/admin/lib/utils'

export function GalleriesListPage() {
  const { data: galleries, isLoading } = useGalleries()

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
            <Card key={gallery.id} className="overflow-hidden flex flex-col">
              <div className="aspect-video bg-muted flex items-center justify-center border-b">
                <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <CardHeader className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant={gallery.status === 'published' ? 'default' : 'secondary'}>
                    {gallery.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{gallery.imageCount} images</span>
                </div>
                <CardTitle className="text-lg truncate">{gallery.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-1">
                <p className="text-xs text-muted-foreground">Created {formatDate(gallery.createdAt)}</p>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link to={`/admin/galleries/${gallery.id}/edit`}>
                    <FileEdit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <p className="col-span-full py-10 text-center text-muted-foreground">No galleries found</p>
        )}
      </div>
    </div>
  )
}
