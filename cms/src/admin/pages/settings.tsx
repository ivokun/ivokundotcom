import { Check,Copy, Key, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '~/admin/components/page-header'
import { Button } from '~/admin/components/ui/button'
import { Card, CardContent, CardDescription,CardHeader, CardTitle } from '~/admin/components/ui/card'
import { Input } from '~/admin/components/ui/input'
import { Label } from '~/admin/components/ui/label'
import { Switch } from '~/admin/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/admin/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/admin/components/ui/tooltip' 
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '~/admin/hooks/use-api-keys'
import { formatDate } from '~/admin/lib/utils'

export function SettingsPage() {
  const { data: apiKeys, isLoading } = useApiKeys()
  const createApiKey = useCreateApiKey()
  const deleteApiKey = useDeleteApiKey()

  const [newKeyName, setNewKeyName] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{ key: string; name: string } | null>(null)

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cms-dark-mode') === 'true'
    }
    return false
  })

  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked)
    localStorage.setItem('cms-dark-mode', String(checked))
    document.documentElement.classList.toggle('dark', checked)
  }

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName) return
    createApiKey.mutate({ name: newKeyName }, {
      onSuccess: (data) => {
        toast.success('API Key created - Copy it now, it will not be shown again!')
        setNewlyCreatedKey({ key: data.key, name: newKeyName })
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Switch disabled />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Not yet implemented</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Use the dark theme for the admin panel</p>
              </div>
              <Switch checked={darkMode} onCheckedChange={handleDarkModeToggle} />
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
              <Button
                type="submit"
                disabled={!newKeyName || createApiKey.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                {createApiKey.isPending ? 'Creating...' : 'Generate'}
              </Button>
            </form>

            {newlyCreatedKey && (
              <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-primary">New API Key Created: {newlyCreatedKey.name}</h4>
                  <Button variant="ghost" size="sm" onClick={() => setNewlyCreatedKey(null)}>Dismiss</Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Copy this key now. It will not be shown again!
                </p>
                <div className="flex items-center gap-2 p-3 bg-background rounded border font-mono text-sm">
                  <code className="flex-1 break-all text-foreground font-bold">{newlyCreatedKey.key || 'Error: Key not received'}</code>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => copyToClipboard(newlyCreatedKey.key)}
                  >
                    {copiedKey === newlyCreatedKey.key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

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
                            <span>{key.prefix}••••••••••</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(key.createdAt || (key as any).created_at)}</TableCell>
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
