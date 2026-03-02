# Data Integrity Issues

**Total Issues:** 18  
**Critical:** 6 | **High:** 5 | **Medium:** 4 | **Low:** 3

---

## 🔴 Critical

### DATA-001: Race Condition in Slug Conflict Check (Posts)
| | |
|---|---|
| **File** | `post.service.ts:289-327` |
| **Issue** | Non-atomic check-then-insert pattern |
| **Risk** | Duplicate slugs possible with concurrent requests |
| **Status** | ✅ Fixed — Catches DB unique constraint violation (23505) and maps to `SlugConflict` (`04fbab2`)

**Current Code:**
```typescript
const existing = yield* query('check_post_slug', (db) => ...);
if (existing) {
  return yield* Effect.fail(new SlugConflict({ slug, locale }));
}
// Race window here!
return yield* query('create_post', (db) => db.insertInto('posts').values(newPost)...);
```

**Recommended Fix:**
```typescript
// Add unique constraint on (slug, locale) and catch the error
try {
  return yield* query('create_post', (db) => ...);
} catch (error) {
  if (isUniqueViolation(error)) {
    return yield* Effect.fail(new SlugConflict({ slug, locale }));
  }
  throw error;
}
```

---

### DATA-002: Race Condition in Slug Conflict Check (Categories)
| | |
|---|---|
| **File** | `category.service.ts:64-71`, `category.service.ts:93-104` |
| **Issue** | Same race condition as posts |
| **Status** | ✅ Fixed — `04fbab2`

---

### DATA-003: Race Condition in Slug Generation (Galleries)
| | |
|---|---|
| **File** | `gallery.service.ts:205-212` |
| **Issue** | Concurrent requests with same title could both pass check |
| **Status** | ✅ Fixed — `04fbab2`

---

### DATA-004: Race Condition in confirmUpload
| | |
|---|---|
| **File** | `media.service.ts:145-182` |
| **Issue** | Multiple concurrent calls can all pass status check |
| **Status** | ✅ Fixed — Atomic `UPDATE WHERE status='uploading'` (`2ce6fdf`)

**Recommended Fix:**
```typescript
const confirmUpload = (mediaId: string) =>
  Effect.gen(function* () {
    // Atomic update
    const result = yield* query('confirm_upload', (db) =>
      db
        .updateTable('media')
        .set({ status: 'processing' })
        .where('id', '=', mediaId)
        .where('status', '=', 'uploading')
        .returningAll()
        .executeTakeFirst()
    );
    
    if (!result) {
      return yield* Effect.fail(new ValidationError({ 
        errors: [{ path: 'status', message: 'Media not in uploadable state' }] 
      }));
    }
    // ...
  });
```

---

### DATA-005: No Foreign Key Validation for Relationships
| | |
|---|---|
| **File** | `post.service.ts:310-322`, `post.service.ts:362-375` |
| **Issue** | `category_id` and `featured_image` not validated |
| **Risk** | Orphaned references, unclear error messages |
| **Status** | ✅ Fixed — Category existence validated before post create/update; returns `CategoryNotFound` → 422 (`6919924`)

---

### DATA-006: Missing Media Validation - Orphaned References
| | |
|---|---|
| **File** | `gallery.service.ts:199-250` |
| **Issue** | Service accepts media IDs but never validates they exist |
| **Risk** | Orphaned gallery image references |
| **Status** | ✅ Fixed — Media IDs validated with `status='ready'` check; returns `MediaNotFound` → 422 (`6919924`)

---

## 🟠 High

### DATA-007: Transaction Implementation Breaks Effect Semantics
| | |
|---|---|
| **File** | `db.service.ts:67-73` |
| **Issue** | Uses `Effect.runPromise` inside Promise, breaking composition |
| **Status** | ✅ Fixed — `Effect.async` bridge replaces `Effect.runPromise` inside Promise (`2ce6fdf`)

**Current Code:**
```typescript
const transaction = <T, E>(
  fn: (trx: Kysely<Database>) => Effect.Effect<T, E>
): Effect.Effect<T, E | DatabaseError> =>
  Effect.tryPromise({
    try: () => db.transaction().execute((trx) => Effect.runPromise(fn(trx))), // ❌
    catch: (error) => new DatabaseError({ cause: error, operation: 'transaction' }),
  });
```

**Recommended Fix:**
```typescript
const transaction = <T, E>(
  fn: (trx: Kysely<Database>) => Effect.Effect<T, E>
): Effect.Effect<T, E | DatabaseError> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: () => db.transaction().begin(),
      catch: (error) => new DatabaseError({ cause: error, operation: 'transaction_begin' }),
    }),
    (trx) => fn(trx as unknown as Kysely<Database>),
    (trx, exit) => Effect.tryPromise({
      try: () => exit._tag === 'Success' ? trx.commit() : trx.rollback(),
      catch: () => undefined,
    })
  );
```

---

### DATA-008: Pool Cleanup May Fail Silently
| | |
|---|---|
| **File** | `db.service.ts:76-85` |
| **Issue** | Empty catch block swallows all errors |
| **Status** | ✅ Fixed — Pool cleanup errors now logged with `Effect.tryPromise` (`2ce6fdf`)

---

### DATA-009: No Transaction Support for Multi-Query Operations
| | |
|---|---|
| **File** | `post.service.ts:399-482` |
| **Issue** | `findAll` executes two queries without transaction |
| **Risk** | Inconsistent results if data changes between queries |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** `findAll` uses `Effect.all([count, list])` for concurrent queries

---

### DATA-010: Unpublish Loses Published Date
| | |
|---|---|
| **File** | `server.ts:763-772` |
| **Issue** | `published_at` not cleared when unpublishing |
| **Status** | ✅ Fixed — `published_at: null` set on unpublish (`04fbab2`)

---

### DATA-011: Infinite Worker Loop Without Backoff
| | |
|---|---|
| **File** | `media-processor.ts:96-107` |
| **Issue** | Immediate retry on any error, no rate limiting |
| **Risk** | Resource exhaustion with malformed images |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** `Effect.retry(Schedule.recurs(5).intersect(exponential+jitter))` wraps `processJob`

## 🟡 Medium

### DATA-012: Keywords Field Storage vs API Mismatch
| | |
|---|---|
| **File** | `types.ts:162`, `admin/api.ts:432-433` |
| **Issue** | Stored as comma-separated, API uses array |
| **Risk** | Keywords containing commas break parsing |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** Keywords parsed CSV→`string[]` on read, serialized `string[]`→CSV on write in `home.service.ts`

---

### DATA-013: Orphaned Upload Cleanup Missing
| | |
|---|---|
| **File** | `media.service.ts`, `media-processor.ts` |
| **Issue** | Incomplete uploads never cleaned up |
| **Status** | ✅ Fixed — Hourly cleanup job via `Effect.forkDaemon` + `Schedule.fixed(Duration.hours(1))` (`90c9dc3`)

---

### DATA-014: No Soft Delete Support
| | |
|---|---|
| **File** | `post.service.ts:378-387` |
| **Issue** | Posts permanently deleted, no recovery |
| **Status** | 🔴 Open |

---

### DATA-015: Missing Duplicate File Detection
| | |
|---|---|
| **File** | `media.service.ts` |
| **Issue** | Same file can be uploaded multiple times |
| **Status** | 🔴 Open |

---

## 🟢 Low

### DATA-016: Generated Password Bias
| | |
|---|---|
| **File** | `user.service.ts:70-78` |
| **Issue** | Uses modulo which creates bias |
| **Status** | 🔴 Open |

---

### DATA-017: Inconsistent Image ID Generation
| | |
|---|---|
| **File** | `gallery.service.ts:120, 183, 243, 323` |
| **Issue** | ID format `${result.id}-${order}` not truly unique |
| **Status** | 🔴 Open |

---

### DATA-018: Missing Unique Constraint Test for Home Singleton
| | |
|---|---|
| **File** | `home.service.test.ts` |
| **Issue** | No test for database singleton constraint |
| **Status** | 🔴 Open |
