import { PageHeader } from '~/admin/components/page-header'
import { Card, CardContent } from '~/admin/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/admin/components/ui/table'
import { Badge } from '~/admin/components/ui/badge'
import { Button } from '~/admin/components/ui/button'
import { Plus, MoreHorizontal, UserCheck, Shield, Trash } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/admin/components/ui/dropdown-menu'

export function UsersPage() {
  // Simple static list for now as per reference
  const users = [
    { id: '1', name: 'Admin User', email: 'admin@ivokun.com', role: 'admin', status: 'active' }
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Manage access and roles for the admin panel">
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </PageHeader>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1">
                    <Shield className="h-3 w-3" />
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className="bg-green-500 hover:bg-green-600">
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Edit Role
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash className="mr-2 h-4 w-4" />
                        Revoke Access
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
