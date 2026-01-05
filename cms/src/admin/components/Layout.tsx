import { createSignal, Show, For } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { authStore } from '../store';

interface LayoutProps {
  children?: import('solid-js').JSX.Element;
}

export default function Layout(props: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'home' },
    { path: '/posts', label: 'Posts', icon: 'document' },
    { path: '/categories', label: 'Categories', icon: 'folder' },
    { path: '/galleries', label: 'Galleries', icon: 'photo' },
    { path: '/media', label: 'Media', icon: 'image' },
    { path: '/home', label: 'Home Page', icon: 'globe' },
    { path: '/settings', label: 'Settings', icon: 'cog' },
  ];
  
  function handleLogout() {
    authStore.logout();
    navigate('/login');
  }
  
  return (
    <div class="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside class={`${sidebarOpen() ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div class="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <Show when={sidebarOpen()}>
            <span class="font-bold text-lg text-gray-900">CMS Admin</span>
          </Show>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen())}
            class="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={sidebarOpen() ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"} />
            </svg>
          </button>
        </div>
        
        {/* Navigation */}
        <nav class="flex-1 py-4 overflow-y-auto">
          <ul class="space-y-1 px-3">
            <For each={navItems}>
              {(item) => (
                <li>
                  <a
                    href={item.path}
                    class={`sidebar-link ${
                      location.pathname === item.path ||
                      (item.path !== '/' && location.pathname.startsWith(item.path))
                        ? 'sidebar-link-active'
                        : 'sidebar-link-inactive'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.path);
                    }}
                  >
                    <NavIcon name={item.icon} />
                    <Show when={sidebarOpen()}>
                      <span>{item.label}</span>
                    </Show>
                  </a>
                </li>
              )}
            </For>
          </ul>
        </nav>
        
        {/* User */}
        <div class="border-t border-gray-200 p-4">
          <Show when={authStore.state().user} fallback={<div class="text-sm text-gray-500">Loading...</div>}>
            {(user) => (
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <span class="text-primary-700 font-medium text-sm">
                    {user().name?.charAt(0).toUpperCase() || 'A'}
                  </span>
                </div>
                <Show when={sidebarOpen()}>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">{user().name}</p>
                    <p class="text-xs text-gray-500 truncate">{user().email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    title="Logout"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </aside>
      
      {/* Main Content */}
      <main class="flex-1 overflow-auto">
        {props.children}
      </main>
    </div>
  );
}

function NavIcon(props: { name: string }) {
  const icons: Record<string, string> = {
    home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    document: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    folder: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
    photo: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    globe: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
    cog: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  };
  
  return (
    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icons[props.name] || icons['home']} />
    </svg>
  );
}
