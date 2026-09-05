import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Image as ImageIcon,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Tags,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Avatar, AvatarFallback } from '~/admin/components/ui/avatar';
import { Button } from '~/admin/components/ui/button';
import { Separator } from '~/admin/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/admin/components/ui/tooltip';
import { useCurrentUser, useLogout } from '~/admin/hooks/use-auth';
import { cn } from '~/admin/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { label: 'Posts', icon: FileText, href: '/admin/posts' },
  { label: 'Media', icon: ImageIcon, href: '/admin/media' },
  { label: 'Categories', icon: Tags, href: '/admin/categories' },
  { label: 'Galleries', icon: Images, href: '/admin/galleries' },
  { label: 'Home Page', icon: Home, href: '/admin/home' },
  { label: 'Users', icon: Users, href: '/admin/users' },
  { label: 'Settings', icon: Settings, href: '/admin/settings' },
];

const AVATAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-green-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
];

const SIDEBAR_COLLAPSED_KEY = 'ivokun-admin-sidebar-collapsed';

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/admin') {
    // Dashboard is exact-match only
    return pathname === '/admin';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: user, isLoading } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // localStorage unavailable — keep in-memory state only
      }
      return next;
    });
  };

  // Move navigation side-effect out of the render body.
  // Calling navigate() directly during render fails silently in React 18
  // StrictMode because side effects are not allowed during render.
  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: '/admin/login' });
    }
  }, [isLoading, user, navigate]);

  // Close the mobile sidebar whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // While the auth check is in-flight, or while the redirect is pending,
  // show a neutral loading screen so the user never sees a blank page.
  if (isLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => navigate({ to: '/admin/login' }),
    });
  };

  const avatarColorClass = user.name
    ? AVATAR_COLORS[user.name.charCodeAt(0) % AVATAR_COLORS.length]
    : AVATAR_COLORS[0];

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-6">
        <Link to="/admin" className="flex items-center gap-2 font-bold text-xl">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
            I
          </div>
          {!collapsed && <span>ivokun</span>}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary navigation">
        {navItems.map((item) => {
          const isActive = isNavItemActive(location.pathname, item.href);
          const link = (
            <Link
              key={item.href}
              to={item.href}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (!collapsed) {
            return <React.Fragment key={item.href}>{link}</React.Fragment>;
          }

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="p-4">
        <Separator className="mb-4" />
        <div className={cn('flex items-center gap-3', collapsed ? 'justify-center' : 'px-2')}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className={avatarColorClass}>
              {user.name?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className={cn(
            'mt-4 w-full justify-start gap-3 text-muted-foreground hover:text-destructive',
            collapsed && 'justify-center'
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen bg-background">
        {/* Mobile Sidebar Overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          id="mobile-sidebar"
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-64 border-r bg-card transition-transform lg:static lg:translate-x-0',
            collapsed ? 'lg:w-20' : 'lg:w-64',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <SidebarContent />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle sidebar"
            className="absolute -right-4 top-20 hidden h-8 w-8 rounded-full border bg-background lg:flex"
            onClick={toggleCollapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="flex h-16 items-center border-b px-6 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-sidebar"
            >
              <Menu className="h-6 w-6" />
            </Button>
            <span className="ml-4 font-bold">ivokun</span>
          </header>
          <div className="flex-1 overflow-auto p-6">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
