import { useState, useEffect } from 'react'
import { PageHeader } from '~/admin/components/page-header'
import { Button } from '~/admin/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/admin/components/ui/card'
import { Input } from '~/admin/components/ui/input'
import { Label } from '~/admin/components/ui/label'
import { RichTextEditor } from '~/admin/components/rich-text-editor'
import { MediaPicker } from '~/admin/components/media-picker'
import { useHome, useUpdateHome } from '~/admin/hooks/use-home'
import { Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '~/admin/components/ui/badge'

export function HomePageEditor() {
  const { data: home, isLoading } = useHome()
  const updateHome = useUpdateHome()

  const [formData, setFormData] = useState({
    description: '',
    heroImageId: '',
    keywords: [] as string[]
  })
  const [newKeyword, setNewKeyword] = useState('')

  useEffect(() => {
    if (home) {
      setFormData({
        description: home.description || '',
        heroImageId: home.heroImageId || '',
        keywords: home.keywords || []
      })
    }
  }, [home])

  const handleSave = () => {
    updateHome.mutate(formData, {
      onSuccess: () => toast.success('Home page updated'),
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

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title="Home Page" description="Manage your website's landing page content">
        <Button onClick={handleSave} disabled={updateHome.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {updateHome.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </PageHeader>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Hero Section</CardTitle>
            <CardDescription>Main title and featured image on the home page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Hero Image</Label>
              {formData.heroImageId ? (
                <div className="relative aspect-[21/9] overflow-hidden rounded-md border bg-muted">
                  <img 
                    src={`/uploads/media-${formData.heroImageId}`} 
                    className="h-full w-full object-cover" 
                    alt="Hero"
                  />
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => setFormData(prev => ({ ...prev, heroImageId: '' }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <MediaPicker onSelect={(m) => setFormData(prev => ({ ...prev, heroImageId: m.id }))} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content & SEO</CardTitle>
            <CardDescription>Main description and metadata for search engines</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Short Description</Label>
              <RichTextEditor 
                content={formData.description} 
                onChange={(v) => setFormData(prev => ({ ...prev, description: v }))}
                placeholder="Briefly describe what your site is about..."
              />
            </div>

            <div className="space-y-2">
              <Label>Global Keywords</Label>
              <div className="flex gap-2">
                <Input 
                  value={newKeyword} 
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                  placeholder="e.g. photography, tech, blog"
                />
                <Button variant="outline" onClick={addKeyword}>Add</Button>
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
      </div>
    </div>
  )
}
