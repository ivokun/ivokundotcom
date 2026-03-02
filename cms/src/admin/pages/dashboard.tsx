import { Link } from '@tanstack/react-router'
import { AlertCircle, FileText, Image as ImageIcon, Plus, Tags } from 'lucide-react'

import { PageHeader } from '~/admin/components/page-header'
import { Badge } from '~/admin/components/ui/badge'
import { Button } from '~/admin/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/admin/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/admin/components/ui/table'
import { useCategories } from '~/admin/hooks/use-categories'
import { useMedia } from '~/admin/hooks/use-media'
import { usePosts } from '~/admin/hooks/use-posts'
import { cn, formatDate } from '~/admin/lib/utils'

function SkeletonStat() {
  return (
    <div className="h-8 w-16 animate-pulse rounded bg-muted" />
  )
}

export function DashboardPage() {
  const { data: posts, isLoading: postsLoading, isError: postsError } = usePosts({ page: 1 })
  const { data: media, isLoading: mediaLoading, isError: mediaError } = useMedia()
  const { data: categories, isLoading: categoriesLoading, isError: categoriesError } = useCategories()

  const isLoading = postsLoading || mediaLoading || categoriesLoading
  const hasError = postsError || mediaError || categoriesError

  const stats = [
    { label: 'Total Posts', value: posts?.meta.total ?? 0, icon: FileText, color: 'text-blue-500' },
    { label: 'Media Items', value: media?.meta.total ?? 0, icon: ImageIcon, color: 'text-green-500' },
    { label: 'Categories', value: categories?.meta.total ?? 0, icon: Tags, color: 'text-purple-500' },
  ]

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Overview of your content">
        <Button asChild>
          <Link to="/admin/posts/new">
            <Plus className="mr-2 h-4 w-4" />
            New Post
          </Link>
        </Button>
      </PageHeader>

      {hasError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>Failed to load dashboard data. Please refresh the page to try again.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <SkeletonStat /> : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts?.data.slice(0, 5).map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">
                      <Link to="/admin/posts/$id/edit" params={{ id: post.id }} className="hover:underline">
                        {post.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(post.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
                {!posts?.data.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                      No posts yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/admin/media">Upload Media</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/admin/galleries/new">Create Gallery</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/admin/home">Edit Home Page</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


