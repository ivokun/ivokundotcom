import { Link } from '@tanstack/react-router'
import { FileEdit, Globe, MoreHorizontal, Plus, Search, Trash } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/admin/components/ui/dropdown-menu'
import { Input } from '~/admin/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/admin/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/admin/components/ui/table'
import { useCategories } from '~/admin/hooks/use-categories'
import { useDeletePost, usePosts } from '~/admin/hooks/use-posts'
import { formatDate } from '~/admin/lib/utils'

export function PostsListPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>('all')
  const [locale, setLocale] = useState<string>('all')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const { data: posts, isLoading } = usePosts({
    page,
    status: status === 'all' ? undefined : status,
    locale: locale === 'all' ? undefined : locale,
    categoryId: categoryId === 'all' ? undefined : categoryId,
  })

  const { data: categories } = useCategories()
  const deletePost = useDeletePost()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const categoryMap = useMemo(
    () => new Map(categories?.data?.map((c) => [c.id, c.name]) ?? []),
    [categories?.data],
  )

  const handleDelete = () => {
    if (deleteId) {
      deletePost.mutate(deleteId, {
        onSuccess: () => {
          toast.success('Post deleted')
          setDeleteId(null)
        },
        onError: (err) => toast.error(err.message),
      })
    }
  }

  const filteredPosts =
    posts?.data.filter((post) =>
      post.title.toLowerCase().includes(debouncedSearch.toLowerCase()),
    ) ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Posts" description="Manage your blog posts and articles">
        <Button asChild>
          <Link to="/admin/posts/new">
            <Plus className="mr-2 h-4 w-4" />
            New Post
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
        <div className="flex flex-1 items-center gap-2 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            className="h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Locale" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locales</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="id">Indonesian</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.data.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Title</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Locale</TableHead>
              <TableHead scope="col">Category</TableHead>
              <TableHead scope="col">Created At</TableHead>
              <TableHead scope="col" className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Loading posts...
                </TableCell>
              </TableRow>
            ) : filteredPosts.length ? (
              filteredPosts.map((post) => (
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
                  <TableCell>
                    <div className="flex items-center gap-1 uppercase text-xs font-semibold text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      {post.locale}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(post.category_id && categoryMap.get(post.category_id)) ?? '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(post.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to="/admin/posts/$id/edit" params={{ id: post.id }}>
                            <FileEdit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteId(post.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No posts found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredPosts.length} of {posts?.meta.total ?? 0} posts
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!posts || (page - 1) * 20 + posts.data.length >= posts.meta.total}
          >
            Next
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletePost.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePost.isPending ? 'Deleting...' : 'Delete Post'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
