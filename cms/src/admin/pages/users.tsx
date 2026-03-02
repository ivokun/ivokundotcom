import { Check, Copy, MoreHorizontal, Plus, Shield, Trash, UserCheck, X } from 'lucide-react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/admin/components/ui/tooltip'
import { useDeleteUser, useInviteUser, useUsers } from '~/admin/hooks/use-users'
import { formatDate } from '~/admin/lib/utils'

export function UsersPage() {
  const { data: users, isLoading } = useUsers()
  const inviteUser = useInviteUser()
  const deleteUser = useDeleteUser()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [newlyInvitedUser, setNewlyInvitedUser] = useState<{
    name: string
    email: string
    initialPassword: string
  } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [inviteErrors, setInviteErrors] = useState<{
    name?: string
    email?: string
  }>({})

  const validateInviteForm = (): boolean => {
    const errors: { name?: string; email?: string } = {}

    if (!inviteName.trim()) {
      errors.name = 'Name is required'
    } else if (inviteName.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters'
    }

    if (!inviteEmail.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      errors.email = 'Please enter a valid email address'
    }

    setInviteErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateInviteForm()) return

    inviteUser.mutate(
      { name: inviteName, email: inviteEmail },
      {
        onSuccess: (data) => {
          toast.success('User invited successfully')
          setNewlyInvitedUser({
            name: data.name,
            email: data.email,
            initialPassword: data.initialPassword,
          })
          setInviteName('')
          setInviteEmail('')
          setInviteErrors({})
          setInviteOpen(false)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const handleDelete = () => {
    if (deleteId) {
      deleteUser.mutate(deleteId, {
        onSuccess: () => {
          toast.success('User deleted')
          setDeleteId(null)
        },
        onError: (err) => toast.error(err.message),
      })
    }
  }

  const copyPassword = () => {
    if (newlyInvitedUser?.initialPassword) {
      navigator.clipboard.writeText(newlyInvitedUser.initialPassword)
      setCopiedPassword(true)
      toast.success('Password copied')
      setTimeout(() => setCopiedPassword(false), 2000)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage access and roles for the admin panel"
      >
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </PageHeader>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">User</TableHead>
              <TableHead scope="col">Role</TableHead>
              <TableHead scope="col">Created At</TableHead>
              <TableHead scope="col" className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground"
                >
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users?.data.length ? (
              users.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name || 'Unnamed User'}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <Shield className="h-3 w-3" />
                      admin
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <DropdownMenuItem disabled>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Edit Role
                                </DropdownMenuItem>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Not yet implemented</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(user.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Revoke Access
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground"
                >
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Invite User Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={inviteName}
                onChange={(e) => {
                  setInviteName(e.target.value)
                  if (inviteErrors.name) {
                    setInviteErrors((prev) => ({ ...prev, name: undefined }))
                  }
                }}
                placeholder="User's full name"
                aria-invalid={inviteErrors.name ? 'true' : 'false'}
              />
              {inviteErrors.name && (
                <p className="text-xs text-destructive">{inviteErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value)
                  if (inviteErrors.email) {
                    setInviteErrors((prev) => ({ ...prev, email: undefined }))
                  }
                }}
                placeholder="user@example.com"
                aria-invalid={inviteErrors.email ? 'true' : 'false'}
              />
              {inviteErrors.email && (
                <p className="text-xs text-destructive">{inviteErrors.email}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviteUser.isPending}>
                {inviteUser.isPending ? 'Inviting...' : 'Invite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Show Initial Password Dialog */}
      <Dialog
        open={!!newlyInvitedUser}
        onOpenChange={(open) => !open && setNewlyInvitedUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Invited Successfully</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              <strong>{newlyInvitedUser?.name}</strong> has been invited with email{' '}
              <strong>{newlyInvitedUser?.email}</strong>.
            </p>
            <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Copy this initial password now. It will not be shown again!
              </p>
              <div className="flex items-center gap-2 p-3 bg-background rounded border font-mono text-sm">
                <code className="flex-1 break-all text-foreground font-bold">
                  {newlyInvitedUser?.initialPassword}
                </code>
                <Button variant="outline" size="sm" onClick={copyPassword}>
                  {copiedPassword ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewlyInvitedUser(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently revoke access
              for this user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
