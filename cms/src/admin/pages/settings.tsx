import { useState } from 'react'
import { PageHeader } from '~/admin/components/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/admin/components/ui/card'
import { Label } from '~/admin/components/ui/label'
import { Switch } from '~/admin/components/ui/switch'
import { Button } from '~/admin/components/ui/button'
import { Input } from '~/admin/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/admin/components/ui/table'
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '~/admin/hooks/use-api-keys'
import { Key, Plus, Trash, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '~/admin/lib/utils'

export function SettingsPage() {
  const { data: apiKeys, isLoading } = useApiKeys()
  const createApiKey = useCreateApiKey()
  const deleteApiKey = useDeleteApiKey()

  const [newKeyName, setNewKeyName] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName) return
    createApiKey.mutate({ name: newKeyName }, {
      onSuccess: () => {
        toast.success('API Key created')
        setNewKeyName('')
      },
      onError: (err) => toast.error(err.message)
    })
  }

  const handleDeleteKey = (id: string) => {
    if (confirm('Are you sure you want to delete this API key? Applications using it will stop working.')) {
      deleteApiKey.mutate(id, {
        onSuccess: () => toast.success('API Key deleted'),
        onError: (err) => toast.error(err.message)
      })
    }
  }

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    toast.success('API key copied')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title="Settings" description="Manage your CMS preferences and API access" />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General Preferences</CardTitle>
            <CardDescription>UI and general application settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">Disable public access to the API</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Use the dark theme for the admin panel</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Manage access keys for external applications</CardDescription>
              </div>
              <Key className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleCreateKey} className="flex gap-2">
              <Input 
                placeholder="Key Name (e.g. Website Production)" 
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <Button type="submit" disabled={createApiKey.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Generate
              </Button>
            </form>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
                  ) : apiKeys?.length ? (
                    apiKeys.map(key => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                            <span>••••••••••••••••</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(key.key)}>
                              {copiedKey === key.key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(key.createdAt)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteKey(key.id)}>
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No API keys found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
