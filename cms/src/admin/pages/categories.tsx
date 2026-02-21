import { FileEdit, MoreHorizontal, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import slugify from 'slugify'
import { toast } from 'sonner'

import { PageHeader } from '~/admin/components/page-header'
import { Button } from '~/admin/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/admin/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/admin/components/ui/dropdown-menu'
import { Input } from '~/admin/components/ui/input'
import { Label } from '~/admin/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/admin/components/ui/table'
import { useCategories, useCreateCategory, useDeleteCategory,useUpdateCategory } from '~/admin/hooks/use-categories'
import { formatDate } from '~/admin/lib/utils'

export function CategoriesPage() {
  const { data: categories, isLoading } = useCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const openCreate = () => {
    setEditingCategory(null)
    setName('')
    setSlug('')
    setModalOpen(true)
  }

  const openEdit = (cat: any) => {
    setEditingCategory(cat)
    setName(cat.name)
    setSlug(cat.slug)
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, data: { name, slug } }, {
        onSuccess: () => {
          toast.success('Category updated')
          setModalOpen(false)
        },
        onError: (err) => toast.error(err.message)
      })
    } else {
      createCategory.mutate({ name, slug }, {
        onSuccess: () => {
          toast.success('Category created')
          setModalOpen(false)
        },
        onError: (err) => toast.error(err.message)
      })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      deleteCategory.mutate(id, {
        onSuccess: () => toast.success('Category deleted'),
        onError: (err) => toast.error(err.message)
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Categories" description="Organize your posts into categories">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Category
        </Button>
      </PageHeader>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  Loading categories...
                </TableCell>
              </TableRow>
            ) : categories?.data.length ? (
              categories.data.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="font-mono text-xs">{cat.slug}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(cat.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(cat)}>
                          <FileEdit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(cat.id)}>
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
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  No categories found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => {
                  setName(e.target.value)
                  if (!editingCategory) setSlug(slugify(e.target.value, { lower: true, strict: true }))
                }} 
                placeholder="e.g. Technology" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input 
                id="slug" 
                value={slug} 
                onChange={(e) => setSlug(e.target.value)} 
                placeholder="e.g. technology" 
                required 
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
