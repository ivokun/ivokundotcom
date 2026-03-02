# Testing Coverage Issues

**Total Issues:** 16  
**Critical:** 2 | **High:** 7 | **Medium:** 4 | **Low:** 3

---

## 🔴 Critical

### TEST-001: No Unit Tests for AuthService
| | |
|---|---|
| **File** | Missing: `auth.service.test.ts` |
| **Issue** | Core security logic not tested in isolation |
| **Risk** | Refactoring dangerous, edge cases not verified |
| **Status** | ✅ Fixed — `auth.service.test.ts` created with 16 tests covering credentials, sessions, API keys (`90c9dc3`)

**Required Tests:**
- `hashPassword` - Argon2 hashing
- `verifyPassword` - Correct and incorrect passwords
- `validateCredentials` - Timing attack prevention
- `createSession` - Session creation
- `validateSession` - Session validation and expiry
- `generateApiKey` - Key generation
- `hashApiKey` - Key hashing

---

### TEST-002: No Unit Tests for UserService
| | |
|---|---|
| **File** | Missing: `user.service.test.ts` |
| **Issue** | User management logic not tested |
| **Status** | ✅ Fixed — `user.service.test.ts` created with 9 tests covering findAll, invite, deleteUser (`90c9dc3`)

**Required Tests:**
- `findAll` - List users
- `invite` - User creation with password
- `deleteUser` - User deletion
- `changePassword` - Password update (when implemented)

---

## 🟠 High

### TEST-003: Post Service Test Coverage Gaps
| | |
|---|---|
| **File** | `post.service.test.ts` |
| **Issue** | Missing tests for major functionality |
| **Status** | ✅ Fixed — 23 new tests added: findAll filters, update, delete, slug conflict, CategoryNotFound, pagination (`3d5992d`)

**Missing Tests:**
- Update post
- Delete post
- Find all with filters
- Slug conflict on update
- Category/media relation validation
- Pagination

---

### TEST-004: Category Service Test Coverage Gaps
| | |
|---|---|
| **File** | `category.service.test.ts` |
| **Issue** | Limited test coverage |
| **Status** | ✅ Fixed — 12 new tests added: update, findBySlug, findAll pagination, delete, slug conflict (`3d5992d`)

**Missing Tests:**
- `findBySlug` (success and failure)
- `delete` (success and category-in-use case)
- `findAll` with pagination
- Update with slug conflict
- Update without changing slug (regression)

---

### TEST-005: Gallery Service Test Coverage Gaps
| | |
|---|---|
| **File** | `gallery.service.test.ts` |
| **Issue** | Only 2 tests covering basic functionality |
| **Status** | ✅ Fixed — 18 new tests added: create/update with media validation, findBySlug, pagination, publish/unpublish (`3d5992d`)

**Missing Tests:**
- Update gallery (including slug change)
- Delete gallery
- Slug conflict detection
- Image ordering preservation
- Find by slug
- Find all with pagination
- Publish/unpublish flow
- Category association
- Invalid media ID handling

---

### TEST-006: Media Service Test Coverage Gaps
| | |
|---|---|
| **File** | `media.service.test.ts` |
| **Issue** | Limited test coverage |
| **Status** | ✅ Fixed — 14 tests total: findAll pagination, confirmUpload edge cases, cleanupOrphanedUploads, update (`3d5992d`)

**Missing Tests:**
- `confirmUpload` race conditions
- `update` method
- `findAll` pagination
- `findByIds` with empty array
- Storage failures during delete
- Image processing failures

---

### TEST-007: Missing Test for NotFound Error Case in Home Service
| | |
|---|---|
| **File** | `home.service.test.ts` |
| **Issue** | `NotFound` error path not tested |
| **Status** | 🔒 Won't Fix — Enhancement

---

### TEST-008: Missing Test for Transaction Failure
| | |
|---|---|
| **File** | `db.service.test.ts` |
| **Issue** | No test for transaction rollback behavior |
| **Status** | 🔒 Won't Fix — Enhancement

---

### TEST-009: Test Scope Cleanup Not Guaranteed
| | |
|---|---|
| **File** | `db.service.test.ts:19-26` |
| **Issue** | Scope may not be cleaned up if assertion fails |
| **Status** | 🔒 Won't Fix — Enhancement

**Fix:**
```typescript
const scope = Effect.runSync(Scope.make());
try {
  const result = await Effect.runPromise(...);
  expect(result).toHaveLength(1);
} finally {
  await Effect.runPromise(Scope.close(scope, Exit.void()));
}
```

---

## 🟡 Medium

### TEST-010: Database URL Fallback in Tests
| | |
|---|---|
| **File** | `db.service.test.ts:6-7` |
| **Issue** | Hardcoded credentials in test file |
| **Status** | 🔒 Won't Fix — Enhancement

**Fix:**
```typescript
const TEST_DB_URL = process.env['DATABASE_URL'];
if (!TEST_DB_URL) throw new Error('DATABASE_URL required for tests');
```

---

### TEST-011: beforeAll Not Used in DbService Tests
| | |
|---|---|
| **File** | `db.service.test.ts:1` |
| **Issue** | Each test creates its own scope |
| **Status** | 🔒 Won't Fix — Enhancement

---

### TEST-012: @ts-ignore in Category Tests
| | |
|---|---|
| **File** | `category.service.test.ts:73-74, 120-121` |
| **Issue** | Should use proper type assertions |
| **Status** | ✅ Fixed — `@ts-ignore` replaced with proper type assertions in category tests (`3d5992d`)

---

### TEST-013: Type Safety Issues in Media Tests
| | |
|---|---|
| **File** | `media.service.test.ts:11-19` |
| **Issue** | `any` types used for mocks |
| **Status** | 🔒 Won't Fix — Enhancement

---

## 🟢 Low

### TEST-014: No Cache Invalidation Test on Post Create
| | |
|---|---|
| **File** | `use-posts.ts:21-28` |
| **Issue** | Test that filtered queries are invalidated |
| **Status** | 🔒 Won't Fix — Enhancement

---

### TEST-015: No Test for Slug Uniqueness with Custom Slugs
| | |
|---|---|
| **File** | `post-form.tsx:194-203` |
| **Issue** | User-entered slugs may conflict |
| **Status** | 🔒 Won't Fix — Enhancement

---

### TEST-016: Missing Unique Constraint Test for Home Singleton
| | |
|---|---|
| **File** | `home.service.test.ts` |
| **Issue** | No test for database constraint |
| **Status** | 🔒 Won't Fix — Enhancement
