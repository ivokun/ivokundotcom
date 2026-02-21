import { useNavigate,useParams } from '@tanstack/react-router'
import { ArrowLeft, Eye, Globe, Save, Send, Trash, X } from 'lucide-react'
import { useEffect,useState } from 'react'
import slugify from 'slugify'
import { toast } from 'sonner'

import { MediaPicker } from '~/admin/components/media-picker'
import { PageHeader } from '~/admin/components/page-header'
import { RichTextEditor } from '~/admin/components/rich-text-editor'
import { Badge } from '~/admin/components/ui/badge'
import { Button } from '~/admin/components/ui/button'
import { Card, CardContent } from '~/admin/components/ui/card'
import { Input } from '~/admin/components/ui/input'
import { Label } from '~/admin/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/admin/components/ui/select'
import { Textarea } from '~/admin/components/ui/textarea'
import { useCategories } from '~/admin/hooks/use-categories'
import { useCreatePost, usePost, usePublishPost, useUnpublishPost,useUpdatePost } from '~/admin/hooks/use-posts'
import { formatDate,getMediaUrl } from '~/admin/lib/utils'

export function PostFormPage() {
  const { id } = useParams({ strict: false }) as { id?: string }
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  
  const { data: post, isLoading: postLoading } = usePost(id || '')
  const { data: categories } = useCategories()
  
  const createPost = useCreatePost()
  const updatePost = useUpdatePost()
  const publishPost = usePublishPost()
  const unpublishPost = useUnpublishPost()

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    locale: 'en',
    categoryId: '',
    featuredImageId: '',
    status: 'draft',
    keywords: [] as string[]
  })

  const [newKeyword, setNewKeyword] = useState('')

  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title || '',
        slug: post.slug || '',
        excerpt: post.excerpt || '',
        content: post.content || '',
        locale: post.locale || 'en',
        categoryId: post.categoryId || '',
        featuredImageId: post.featuredImageId || '',
        status: post.status || 'draft',
        keywords: post.keywords || []
      })
    }
  }, [post])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    setFormData(prev => ({
      ...prev,
      title,
      slug: isNew ? slugify(title, { lower: true, strict: true }) : prev.slug
    }))
  }

  const onSave = (publish: boolean = false) => {
    const data = { ...formData, status: publish ? 'published' : formData.status }
    
    if (isNew) {
      createPost.mutate(data, {
        onSuccess: (newPost: any) => {
          toast.success('Post created')
          navigate({ to: `/admin/posts/${newPost.id}/edit` })
        },
        onError: (err) => toast.error(err.message)
      })
    } else {
      updatePost.mutate({ id: id!, data }, {
        onSuccess: () => {
          toast.success('Post updated')
          if (publish && post?.status !== 'published') {
            handlePublish()
          }
        },
        onError: (err) => toast.error(err.message)
      })
    }
  }

  const handlePublish = () => {
    if (isNew) return
    publishPost.mutate(id!, {
      onSuccess: () => toast.success('Post published'),
      onError: (err) => toast.error(err.message)
    })
  }

  const handleUnpublish = () => {
    if (isNew) return
    unpublishPost.mutate(id!, {
      onSuccess: () => toast.success('Post unpublished'),
      onError: (err) => toast.error(err.message)
    })
  }

  const addKeyword = () => {
    if (newKeyword && !formData.keywords.includes(newKeyword)) {
      setFormData(prev => ({ ...prev, keywords: [...prev.keywords, newKeyword] }))
      setNewKeyword('')
    }
  }

  const removeKeyword = (kw: string) => {
    setFormData(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== kw) }))
  }

  if (postLoading && !isNew) return <div>Loading...</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/admin/posts' })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Posts
        </Button>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onSave(false)} disabled={createPost.isPending || updatePost.isPending}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          {post?.status === 'published' ? (
            <Button variant="secondary" size="sm" onClick={handleUnpublish}>
              Unpublish
            </Button>
          ) : (
            <Button size="sm" onClick={() => onSave(true)} disabled={createPost.isPending || updatePost.isPending}>
              <Send className="mr-2 h-4 w-4" />
              Publish
            </Button>
          )}
        </div>
      </div>

      <PageHeader 
        title={isNew ? 'New Post' : 'Edit Post'} 
        description={isNew ? 'Create a new article for your blog' : `Editing: ${post?.title}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input 
                  id="title" 
                  value={formData.title} 
                  onChange={handleTitleChange}
                  placeholder="Enter post title"
                  className="text-lg font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">ivokun.com/blog/</span>
                  <Input 
                    id="slug" 
                    value={formData.slug} 
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="post-slug"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea 
                  id="excerpt" 
                  value={formData.excerpt} 
                  onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="Short summary for SEO and lists"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <Label>Content</Label>
              <RichTextEditor 
                content={formData.content} 
                onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                placeholder="Start writing your amazing story..."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Featured Image</Label>
                {formData.featuredImageId ? (
                  <div className="relative aspect-video overflow-hidden rounded-md border">
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <span className="text-sm text-muted-foreground">Image ID: {formData.featuredImageId.slice(0, 8)}...</span>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => setFormData(prev => ({ ...prev, featuredImageId: '' }))}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <MediaPicker onSelect={(m) => setFormData(prev => ({ ...prev, featuredImageId: m.id }))} />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="locale">Locale</Label>
                <Select value={formData.locale} onValueChange={(v) => setFormData(prev => ({ ...prev, locale: v }))}>
                  <SelectTrigger id="locale">
                    <SelectValue placeholder="Select Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English (EN)</SelectItem>
                    <SelectItem value="de">German (DE)</SelectItem>
                    <SelectItem value="es">Spanish (ES)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.categoryId} onValueChange={(v) => setFormData(prev => ({ ...prev, categoryId: v }))}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorized</SelectItem>
                    {categories?.data.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Keywords</Label>
                <div className="flex gap-2">
                  <Input 
                    value={newKeyword} 
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    placeholder="Add tag..."
                  />
                  <Button variant="outline" size="sm" onClick={addKeyword}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.keywords.map(kw => (
                    <Badge key={kw} variant="secondary" className="gap-1">
                      {kw}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeKeyword(kw)} />
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {!isNew && (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="pt-6 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={post?.status === 'published' ? 'default' : 'secondary'}>{post?.status}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{post ? formatDate(post.createdAt) : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{post ? formatDate(post.updatedAt) : '-'}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
