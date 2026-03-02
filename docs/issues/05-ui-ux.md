# UI/UX & Accessibility Issues

**Total Issues:** 32  
**Critical:** 4 | **High:** 9 | **Medium:** 13 | **Low:** 6

---

## 🔴 Critical

### UX-001: No Error Boundaries
| | |
|---|---|
| **File** | `main.tsx:12-19` |
| **Issue** | Any unhandled error crashes entire admin interface |
| **Status** | ✅ Fixed — `ErrorBoundary` class component created; wraps entire app in `main.tsx` (`6a431c1`)

**Fix:**
```tsx
export class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Please refresh.</div>;
    }
    return this.props.children;
  }
}
```

---

### UX-002: Collapsed Sidebar Missing ARIA
| | |
|---|---|
| **File** | `layout.tsx:77-91` |
| **Issue** | Navigation icons lack proper screen reader support |
| **Status** | ⚠️ Partial — `role="navigation"` + `aria-label="Main navigation"` added to sidebar nav; individual link `aria-current` not yet added (`3d5992d`)

**Fix:**
```tsx
<Link
  aria-current={location.pathname === item.href ? 'page' : undefined}
  aria-label={item.label}
  title={collapsed ? item.label : undefined}
>
```

---

### UX-003: Rich Text Editor Keyboard Accessibility Issues
| | |
|---|---|
| **File** | `rich-text-editor.tsx:63-86, 151-153` |
| **Issue** | `onMouseDown` breaks keyboard navigation, missing `aria-pressed` |
| **Status** | 🔴 Open

**Fix:**
```tsx
<Button
  role="toggle"
  aria-pressed={active}
  aria-label={title}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }}
  tabIndex={0}
/>
```

---

### UX-004: Settings Page Form Submission Logic Error
| | |
|---|---|
| **File** | `settings.tsx:122-149` |
| **Issue** | Button has `type="button"` with inline onClick, bypassing form validation |
| **Status** | ✅ Fixed — API key generate button changed to `type="submit"` inside a form (`6a431c1`)

**Fix:**
```tsx
<form onSubmit={handleCreateKey}>
  <Button type="submit" ... >Generate</Button>
</form>
```

---

## 🟠 High

### UX-005: Dashboard Shows 0 While Loading
| | |
|---|---|
| **File** | `dashboard.tsx:15-23` |
| **Issue** | `posts?.total || 0` displays 0 during loading |
| **Status** | ✅ Fixed — Skeleton placeholder shown during loading instead of 0 (`3d5992d`)

**Fix:**
```tsx
const StatCard = ({ value, isLoading }) => (
  <div className="text-2xl font-bold">
    {isLoading ? <div className="h-8 w-16 bg-muted animate-pulse rounded" /> : value}
  </div>
);
```

---

### UX-006: Missing Error States in Dashboard
| | |
|---|---|
| **File** | `dashboard.tsx:15-17` |
| **Issue** | No error handling for query failures |
| **Status** | ✅ Fixed — Error alert with `AlertCircle` shown when queries fail (`3d5992d`)

---

### UX-007: Media Picker Missing Upload Error Feedback
| | |
|---|---|
| **File** | `media-picker.tsx:28-37` |
| **Issue** | Upload errors only logged to console |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** `toast.error(err.message)` called on upload failure in `media-picker.tsx`

---

### UX-008: Rich Text Editor Data Loss Risk
| | |
|---|---|
| **File** | `rich-text-editor.tsx:42, 51-59` |
| **Issue** | Parse failure returns empty string, overwrites content |
| **Status** | ✅ Fixed — Parse failure shows error UI instead of silently overwriting content (`3d5992d`)

---

### UX-009: Post Form Missing Validation
| | |
|---|---|
| **File** | `post-form.tsx:88-116` |
| **Issue** | Form can be submitted with empty title |
| **Status** | ✅ Fixed — Title and slug validated before submit; inline error messages shown (`af660be`)

**Fix:**
```tsx
const validate = () => {
  const errors = {};
  if (!formData.title.trim()) errors.title = 'Title is required';
  if (!formData.slug.trim()) errors.slug = 'Slug is required';
  setErrors(errors);
  return Object.keys(errors).length === 0;
};
```

---

### UX-010: No Confirmation for Unpublish Action
| | |
|---|---|
| **File** | `post-form.tsx:126-132` |
| **Issue** | Unpublish happens immediately without confirmation |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** `AlertDialog` confirmation added before unpublish action in `post-form.tsx`

---

### UX-011: Missing Loading State for Delete Operation
| | |
|---|---|
| **File** | `posts-list.tsx:57-67` |
| **Issue** | No loading indicator while delete in progress |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** Delete button disabled with `deletePost.isPending` in `posts-list.tsx`

---

### UX-012: Missing Password Change Functionality
| | |
|---|---|
| **File** | `user.service.ts`, `settings.tsx` |
| **Issue** | No UI or API for password change |
| **Status** | 🔴 Open

---

## 🟡 Medium

### UX-013: Missing Debouncing on Search Input
| | |
|---|---|
| **File** | `posts-list.tsx:87-92` |
| **Issue** | Search triggers re-render on every keystroke |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** 300ms debounce with `useEffect` cleanup on search input in `posts-list.tsx`

---

### UX-014: No Optimistic Updates in React Query
| | |
|---|---|
| **File** | `use-posts.ts`, `use-galleries.ts`, etc. |
| **Issue** | Mutations wait for server before updating UI |
| **Status** | 🔴 Open

---

### UX-015: Mobile Sidebar Missing ARIA Attributes
| | |
|---|---|
| **File** | `layout.tsx:124-128, 152-157` |
| **Issue** | Missing `aria-label`, `aria-expanded`, `aria-controls` |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** `aria-expanded`, `aria-controls`, `id="mobile-sidebar"` added to mobile sidebar in `layout.tsx`

---

### UX-016: Table Components Missing Accessibility Attributes
| | |
|---|---|
| **File** | `table.tsx:69-82` |
| **Issue** | Headers should have `scope="col"` |
| **Status** | ✅ Fixed — `scope="col"` added to all `<TableHead>` elements in posts-list, categories, users (`3d5992d`)

---

### UX-017: Media Picker Missing Empty State
| | |
|---|---|
| **File** | `media-picker.tsx:68-105` |
| **Issue** | Empty grid without guidance when no media |
| **Status** | 🔴 Open

---

### UX-018: Login Page Missing Loading State for Button
| | |
|---|---|
| **File** | `login.tsx:62-64` |
| **Issue** | No spinner, inputs remain editable during submission |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** Login inputs and submit button disabled while `login.isPending`

---

### UX-019: No Bulk Operations Support
| | |
|---|---|
| **Files** | `galleries-list.tsx`, `posts-list.tsx` |
| **Issue** | No bulk delete, status changes |
| **Status** | 🔴 Open

---

### UX-020: Missing Drag-and-Drop Support
| | |
|---|---|
| **File** | `media.tsx:117-136` |
| **Issue** | Basic file input, no drag-and-drop zone |
| **Status** | 🔴 Open

---

### UX-021: No Image Editing Capabilities
| | |
|---|---|
| **File** | `image.service.ts`, `media.tsx` |
| **Issue** | No rotate, crop, or adjust images |
| **Status** | 🔴 Open

---

### UX-022: Missing Loading State for Individual Uploads
| | |
|---|---|
| **File** | `use-media.ts:47-48` |
| **Issue** | Only global `isPending`, no per-file states |
| **Status** | 🔴 Open

---

### UX-023: Category Selection Missing in Gallery Form
| | |
|---|---|
| **File** | `gallery-form.tsx` |
| **Issue** | No UI for selecting category despite schema support |
| **Status** | 🔴 Open

---

### UX-024: Missing Post Count in Category List
| | |
|---|---|
| **File** | `categories.tsx` |
| **Issue** | No visibility into category usage |
| **Status** | 🔴 Open

---

### UX-025: Missing `short_description` and `title` Fields in Home Editor
| | |
|---|---|
| **File** | `home.tsx:26-30` |
| **Issue** | Form only shows description, hero, keywords |
| **Status** | ✅ Fixed — `title` and `short_description` fields added to home editor UI and API client (`af660be`)

---

## 🟢 Low

### UX-026: Unused AvatarImage Import
| | |
|---|---|
| **File** | `layout.tsx:19` |
| **Issue** | Could implement user avatars |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** Unused `AvatarImage` import removed from `layout.tsx`

---

### UX-027: Dark Mode Flash on Page Load
| | |
|---|---|
| **File** | `settings.tsx:30-35` |
| **Issue** | Check happens after mount |
| **Status** | 🔴 Open

---

### UX-028: Missing Keyboard Navigation for Keywords
| | |
|---|---|
| **File** | `post-form.tsx:134-143, 294-310` |
| **Issue** | Could add backspace to remove last tag |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** Backspace removes last keyword tag when input is empty in `post-form.tsx`

---

### UX-029: Avatar Fallback Hardcoded
| | |
|---|---|
| **File** | `layout.tsx:99` |
| **Issue** | Always shows first letter, no color variation |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** Avatar colour derived from username hash (6-colour palette) in `layout.tsx`

---

### UX-030: Invite Form Missing Validation Feedback
| | |
|---|---|
| **File** | `users.tsx:218-252` |
| **Issue** | Only HTML5 validation, no inline errors |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** Inline validation on invite form (name ≥2 chars, email regex) in `users.tsx`

---

### UX-031: Category Lookup Inefficiency
| | |
|---|---|
| **File** | `posts-list.tsx:168` |
| **Issue** | O(n*m) complexity with `.find()` |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** `useMemo` categoryMap for O(1) category lookup in `posts-list.tsx`

**Fix:**
```typescript
const categoryMap = useMemo(() => 
  new Map(categories?.data.map(c => [c.id, c])), 
  [categories]
);
```
