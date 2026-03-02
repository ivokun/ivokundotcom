# API & Type Consistency Issues

**Total Issues:** 24  
**Critical:** 2 | **High:** 10 | **Medium:** 8 | **Low:** 4

---

## 🔴 Critical

### API-001: API Key Prefix Length Inconsistency
| | |
|---|---|
| **File** | `auth.service.ts:156`, `schemas.ts:253`, `middleware.ts:134` |
| **Issue** | Prefix length varies: 8 vs 12 characters |
| **Risk** | API key verification will fail |
| **Status** | ✅ Fixed — Schema aligned to `minLength(8)/maxLength(12)` (`e4b4794`)

**Current Code:**
```typescript
// auth.service.ts:156 - Extracts 12 chars
const prefix = key.substring(0, 12);

// schemas.ts:253 - Expects 8 chars
prefix: Schema.String.pipe(Schema.length(8));

// middleware.ts:134 - Extracts 12 chars
const prefix = apiKey.substring(0, 12);
```

**Fix:** Align all to 12 characters.

---

### API-002: Unsafe Type Assertion in TipTap Conversion
| | |
|---|---|
| **File** | `server.ts:215-221` |
| **Issue** | `as TipTapDocument` bypasses validation |
| **Risk** | Invalid data structure stored |
| **Status** | ✅ Fixed — `toTipTapContent()` validates `type === 'doc'` and `content` array before casting (`6919924`)

---

## 🟠 High

### API-003: Pagination Meta Mismatch Between Frontend and Backend
| | |
|---|---|
| **File** | `post.service.ts:531-538`, `api.ts:11-16`, `posts-list.tsx:228` |
| **Issue** | Backend returns `limit`/`offset`, frontend expects `page`/`pageSize` |
| **Status** | ✅ Fixed — Frontend sends `limit`/`offset`; `PaginatedResponse<T>` updated to `{ data, meta: { total, limit, offset } }` (`6ba4179`)

---

### API-004: API Response Structure Mismatch (camelCase vs snake_case)
| | |
|---|---|
| **Files** | Multiple |
| **Issue** | Inconsistent naming across the API |
| **Status** | ✅ Fixed — All admin API responses standardized to snake_case; frontend types updated (`6919924`)

**Affected Files:**
- `category.service.ts:177-184` - Returns snake_case
- `api.ts:82-88` - Expects camelCase
- `galleries-list.tsx:83` - Type workaround `(gallery as any).created_at`

---

### API-005: Type Safety Gap in User Return Type
| | |
|---|---|
| **File** | `auth.service.ts:148-151` |
| **Issue** | `as User` masks potential issues |
| **Status** | ✅ Fixed — `SafeUser = Omit<User, 'password_hash'>` added to `types.ts`; used in `auth.service.ts` (`6919924`)

**Current Code:**
```typescript
const { password_hash: _, ...safeUser } = user;
return safeUser as User;  // Type assertion
```

**Fix:**
```typescript
export type SafeUser = Omit<User, 'password_hash'>;
const { password_hash, ...safeUser } = user;
return safeUser;  // TypeScript verifies
```

---

### API-006: Multiple `any` Type Assertions
| | |
|---|---|
| **Files** | `dashboard.tsx:78-79`, `post-form.tsx:63,324,328`, `posts-list.tsx:171`, `settings.tsx:195` |
| **Issue** | Bypasses TypeScript's type checking |
| **Status** | ✅ Fixed — `as any` removed from `dashboard.tsx`, `post-form.tsx`, `settings.tsx`, `categories.tsx`, `media-picker.tsx` (`6919924`)

---

### API-007: Type Mismatch: Schema vs Service Layer for Images
| | |
|---|---|
| **File** | `schemas.ts:188, 204-220`, `gallery.service.ts:199-250` |
| **Issue** | Schema expects `GalleryImageInput[]`, service uses `string[]` |
| **Status** | ✅ Fixed — Gallery image types aligned; media validation added (`6919924`)

---

### API-008: Missing Keywords Field in Database Schema
| | |
|---|---|
| **File** | `schemas.ts:165`, `types.ts:111-125`, `post.service.ts:310-322` |
| **Issue** | Schema accepts keywords but DB table has no column |
| **Risk** | Data silently dropped |
| **Status** | 🔒 Won't Fix — Enhancement (keywords intentionally stored in home page metadata; post keywords are a planned feature)

---

### API-009: Type Safety Violation with `any` in Categories
| | |
|---|---|
| **File** | `categories.tsx:41` |
| **Issue** | `useState<any>(null)` |
| **Status** | ✅ Fixed — `useState<any>` replaced with typed `EditingCategory` interface (`6919924`)

---

### API-010: Description Field Type Handling Inconsistency
| | |
|---|---|
| **File** | `types.ts:160`, `admin/api.ts:427-431, 444-449` |
| **Issue** | Multiple type checks and JSON parsing attempts |
| **Status** | 🔒 Won't Fix — Enhancement

---

### API-011: Content Parsing Error Handling Only Logs to Console
| | |
|---|---|
| **File** | `api.ts:170-178`, `api.ts:213-221` |
| **Issue** | Silent failure on JSON parse error |
| **Status** | 🔒 Won't Fix — Enhancement (errors logged with context; silent fallback is intentional)

---

### API-012: Tests Use `any` Types
| | |
|---|---|
| **File** | `media.service.test.ts:11-19, 73-80` |
| **Issue** | Unsafe layer construction |
| **Status** | 🔒 Won't Fix — Enhancement (test-only; does not affect runtime safety)

---

## 🟡 Medium

### API-013: Inconsistent Date Field Naming
| | |
|---|---|
| **Files** | Various |
| **Issue** | Mix of `createdAt`/`created_at` |
| **Status** | ✅ Fixed — All responses standardized to snake_case dates (`6919924`)

---

### API-014: Inconsistent Property Naming in Date Display
| | |
|---|---|
| **File** | `categories.tsx:120` |
| **Issue** | `formatDate(cat.createdAt || (cat as any).created_at)` |
| **Status** | ✅ Fixed — `cat.created_at` used directly; `as any` fallback removed (`6919924`)

---

### API-015: Type Definition Duplication
| | |
|---|---|
| **File** | `media.tsx:27-36`, `admin/lib/utils.ts:55-64` |
| **Issue** | `MediaItem` type defined twice |
| **Status** | 🔒 Won't Fix — Enhancement

---

### API-016: Unused Import in middleware.ts
| | |
|---|---|
| **File** | `middleware.ts:9` |
| **Issue** | `InvalidCredentials` imported but not used |
| **Status** | 🔒 Won't Fix — Minor (lint warning only)

---

### API-017: Unused Import in db.service.test.ts
| | |
|---|---|
| **File** | `db.service.test.ts:2` |
| **Issue** | `afterAll` imported but not used |
| **Status** | 🔒 Won't Fix — Minor (lint warning only)

---

### API-018: Unused Import Pattern in categories.tsx
| | |
|---|---|
| **File** | `categories.tsx:1,3` |
| **Issue** | `slugify` imported but never used |
| **Status** | ✅ Fixed — `52b4127`

---

### API-019: Type Assertion for Gallery Images
| | |
|---|---|
| **File** | `gallery-form.tsx:64` |
| **Issue** | `gallery.images?.map((img: any) => ...)` |
| **Status** | 🔒 Won't Fix — Enhancement

---

### API-020: @ts-ignore in Tests
| | |
|---|---|
| **File** | `category.service.test.ts:73-74, 120-121` |
| **Issue** | Should use proper type narrowing |
| **Status** | 🔒 Won't Fix — Enhancement (test files; not runtime)

---

## 🟢 Low

### API-021: Unused Parameter `_filename`
| | |
|---|---|
| **File** | `image.service.ts:99` |
| **Issue** | Parameter prefixed but could be used in logging |
| **Status** | 🔒 Won't Fix — Minor

---

### API-022: HomeService.update Return Type
| | |
|---|---|
| **File** | `home.service.ts:13` |
| **Issue** | Doesn't include `NotFound` in signature |
| **Status** | 🔒 Won't Fix — Enhancement

---

### API-023: Unused AvatarImage Import
| | |
|---|---|
| **File** | `layout.tsx:19` |
| **Issue** | Imported but never used |
| **Status** | ✅ Fixed — `52b4127`

---

### API-024: Select Component Missing aria-label Support
| | |
|---|---|
| **File** | `select.tsx` |
| **Issue** | When used without Label, lacks aria-label |
| **Status** | 🔒 Won't Fix — Enhancement
