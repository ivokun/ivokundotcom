# ADR-003: SolidJS for Admin SPA

> **Status:** Accepted  
> **Date:** 2025-01-06  
> **Deciders:** ivokun  
> **Related:** ADR-001 (CMS Architecture)

## Context

The CMS requires an admin interface for content management. Key requirements:

1. **Single-Page Application** - Client-side routing, no full page reloads
2. **Rich Text Editing** - TipTap/ProseMirror integration for blog content
3. **Image Management** - Upload, preview, picker components
4. **Form Handling** - CRUD forms with validation
5. **Bundle Size** - Embedded in binary, should be small
6. **Developer Experience** - Fast iteration, good TypeScript support

The admin SPA is served from `/admin` and bundled into the single binary.

## Decision

We chose **SolidJS 1.9+** with the following stack:

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **UI Framework** | SolidJS | Small bundle, fine-grained reactivity |
| **Routing** | @solidjs/router | Official router, simple API |
| **Rich Text** | solid-tiptap | SolidJS wrapper for TipTap |
| **Styling** | Tailwind CSS | Utility-first, no runtime CSS-in-JS |
| **Build Tool** | Vite | Fast HMR, optimized production builds |

### Architecture

```
cms/src/admin/
├── index.tsx          # Entry point, router setup
├── index.css          # Tailwind imports
├── api.ts             # Fetch-based API client
├── store.ts           # Auth state (signals)
├── components/
│   ├── Layout.tsx     # Sidebar navigation
│   ├── Modal.tsx      # Reusable modal
│   ├── MediaPicker.tsx # Image selection
│   └── RichTextEditor.tsx # TipTap wrapper
└── pages/
    ├── Login.tsx
    ├── Dashboard.tsx
    ├── Posts.tsx
    ├── PostForm.tsx
    ├── Categories.tsx
    ├── CategoryForm.tsx
    ├── Galleries.tsx
    ├── GalleryForm.tsx
    ├── Media.tsx
    ├── Home.tsx
    └── Settings.tsx
```

### State Management

Simple signals for global auth state:

```typescript
// store.ts
import { createSignal } from 'solid-js'

export const [user, setUser] = createSignal<User | null>(null)
export const [isAuthenticated, setIsAuthenticated] = createSignal(false)

export const checkAuth = async () => {
  try {
    const response = await api.get<User>('/me')
    setUser(response)
    setIsAuthenticated(true)
  } catch {
    setUser(null)
    setIsAuthenticated(false)
  }
}
```

### API Client

Fetch-based client with credentials:

```typescript
// api.ts
const BASE_URL = import.meta.env.VITE_API_BASE || ''

export const api = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(`${BASE_URL}/admin/api${path}`, {
      credentials: 'include',
    })
    if (!res.ok) throw new ApiError(res.status, await res.text())
    if (res.status === 204) return undefined as T
    return res.json()
  },

  post: async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${BASE_URL}/admin/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new ApiError(res.status, await res.text())
    if (res.status === 204) return undefined as T
    return res.json()
  },
  // put, delete similar...
}
```

### Rich Text Editor Integration

TipTap with SolidJS wrapper:

```tsx
// RichTextEditor.tsx
import { createTiptapEditor } from 'solid-tiptap'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'

export function RichTextEditor(props: {
  content: JSONContent | null
  onChange: (content: JSONContent) => void
}) {
  const editor = createTiptapEditor(() => ({
    extensions: [
      StarterKit,
      Image.configure({ inline: true }),
      Link.configure({ openOnClick: false }),
    ],
    content: props.content || { type: 'doc', content: [] },
    onUpdate: ({ editor }) => {
      props.onChange(editor.getJSON())
    },
  }))

  return (
    <div class="border rounded-lg">
      <Toolbar editor={editor()} />
      <div class="prose max-w-none p-4" ref={(el) => editor()?.attach(el)} />
    </div>
  )
}
```

### Build Configuration

Vite config for SPA build:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  root: 'src/admin',
  build: {
    outDir: '../../public/admin',
    emptyOutDir: true,
  },
})
```

## Consequences

### Positive

1. **Small Bundle** - Production build ~80KB gzipped (vs ~150KB+ for React)
2. **No Virtual DOM** - Direct DOM updates, better performance
3. **Familiar Syntax** - JSX syntax similar to React
4. **Fine-Grained Reactivity** - Only affected DOM nodes update
5. **TypeScript Native** - First-class TypeScript support
6. **Fast Development** - Vite HMR is near-instant

### Negative

1. **Smaller Ecosystem** - Fewer component libraries than React
2. **TipTap Integration** - `solid-tiptap` is community-maintained
3. **Learning Curve** - Reactivity model different from React hooks
4. **Hiring** - Fewer developers familiar with SolidJS

### Neutral

1. **No Server Components** - Not needed for admin SPA
2. **Manual Optimization** - No need for memo/useCallback
3. **Signals vs Hooks** - Different mental model, equally capable

## Bundle Analysis

Production build output:

```
dist/
├── index.html           1.2 KB
└── assets/
    ├── index-[hash].js  78 KB (gzipped)
    └── index-[hash].css 12 KB (gzipped)

Total: ~92 KB gzipped
```

Breakdown:
- SolidJS runtime: ~7 KB
- @solidjs/router: ~4 KB
- TipTap + extensions: ~45 KB
- Application code: ~22 KB
- Tailwind CSS: ~12 KB

## Alternatives Considered

### 1. React

**Rejected because:**
- Larger bundle size (~150KB+ with router)
- Virtual DOM overhead unnecessary for admin panel
- Over-engineered for relatively simple CRUD interface

### 2. Vue 3

**Rejected because:**
- Template syntax less familiar than JSX
- Similar bundle size to React
- No significant advantage over SolidJS for this use case

### 3. Svelte

**Rejected because:**
- Compiler-based approach adds build complexity
- TipTap integration less mature than SolidJS
- Runes (Svelte 5) still evolving

### 4. Preact

**Rejected because:**
- React compatibility layer adds complexity
- Community-maintained TipTap wrappers
- SolidJS has better performance characteristics

### 5. HTMX + Server-Rendered HTML

**Rejected because:**
- Rich text editor requires client-side JavaScript anyway
- Would need separate template engine
- Less interactive UX for form-heavy admin

### 6. No Framework (Vanilla JS)

**Rejected because:**
- Manual DOM manipulation tedious for forms
- Would reinvent reactivity system
- No benefit given bundle size acceptable

## References

- [SolidJS Documentation](https://solidjs.com)
- [solid-tiptap](https://github.com/binyamin/solid-tiptap)
- [TipTap Documentation](https://tiptap.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Vite Configuration](https://vitejs.dev/config/)
