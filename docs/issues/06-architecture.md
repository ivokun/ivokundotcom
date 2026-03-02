# Architecture & Design Issues

**Total Issues:** 20  
**Critical:** 6 | **High:** 6 | **Medium:** 6 | **Low:** 2

---

## 🔴 Critical

### ARCH-001: Transaction Implementation Breaks Effect Semantics
| | |
|---|---|
| **File** | `db.service.ts:67-73` |
| **Issue** | `Effect.runPromise` inside Promise breaks composition |
| **Status** | ✅ Fixed — `Effect.async` bridge used instead of `Effect.runPromise` inside Kysely transaction callback (`2ce6fdf`) |

**Problem:**
```typescript
const transaction = <T, E>(fn) =>
  Effect.tryPromise({
    try: () => db.transaction().execute((trx) => Effect.runPromise(fn(trx))),
    // Loses structured concurrency and interruption
  });
```

**Fix:** Use `Effect.acquireUseRelease` pattern.

---

### ARCH-002: Pool Cleanup May Fail Silently
| | |
|---|---|
| **File** | `db.service.ts:76-85` |
| **Issue** | Empty catch block swallows errors |
| **Status** | ✅ Fixed — Pool cleanup uses `Effect.tryPromise` and logs errors (`2ce6fdf`) |

---

### ARCH-003: CORS Configuration Not Actually Applied
| | |
|---|---|
| **File** | `config.ts:27`, `server.ts` |
| **Issue** | `corsOrigin` configured but middleware never applied |
| **Status** | 🔴 Open |

---

### ARCH-004: Code Duplication in Result Mapping
| | |
|---|---|
| **File** | `post.service.ts:144-189, 240-286, 484-528` |
| **Issue** | Same mapping logic repeated 3 times |
| **Status** | 🔴 Open |

---

### ARCH-005: In-Memory Rate Limiter Not Scalable
| | |
|---|---|
| **File** | `middleware.ts:21-32` |
| **Issue** | Map-based storage won't work with multiple instances |
| **Status** | 🔴 Open |

**Fix:** Use Redis or database-backed rate limiting.

---

### ARCH-006: Infinite Worker Loop Without Backoff
| | |
|---|---|
| **File** | `media-processor.ts:96-107` |
| **Issue** | No delay, no backoff, no rate limiting |
| **Status** | 🔴 Open |

**Fix:**
```typescript
yield* processJob(job).pipe(
  Effect.retry({
    schedule: Schedule.exponential('1 second').pipe(Schedule.recurs(3)),
  })
);
```

---

## 🟠 High

### ARCH-007: Missing Pool Error Event Handlers
| | |
|---|---|
| **File** | `db.service.ts:37-42` |
| **Issue** | No handler for pool 'error' events |
| **Risk** | Unhandled promise rejections, crashes |
| **Status** | ✅ Fixed — `pool.on('error', ...)` handler registered (`2ce6fdf`) |

---

### ARCH-008: Hardcoded Pool Configuration
| | |
|---|---|
| **File** | `db.service.ts:39-41` |
| **Issue** | Connection pool limits not configurable |
| **Status** | ✅ Fixed — `DB_POOL_MAX` env var in `config.ts`; pool reads from config (`3d5992d`) |

---

### ARCH-009: No Connection Retry Logic
| | |
|---|---|
| **File** | `db.service.ts:48-56` |
| **Issue** | No retry on initial connection failure |
| **Status** | ✅ Fixed — Connection retry with `Schedule.exponential` backoff added (`2ce6fdf`) |

---

### ARCH-010: No Cache Control Headers on Public API
| | |
|---|---|
| **File** | `server.ts:288-392` |
| **Issue** | No caching strategy for public endpoints |
| **Status** | 🔴 Open |

---

### ARCH-011: Missing Input Validation on Query Parameters
| | |
|---|---|
| **File** | `server.ts:170-176` |
| **Issue** | Query params not strictly validated |
| **Status** | ✅ Fixed — All query params decoded through Effect Schema (`ListQueryParams`, `PostListQueryParams`) (`3d5992d`) |

---

### ARCH-012: Concurrent Variant Processing Memory Risk
| | |
|---|---|
| **File** | `image.service.ts:116` |
| **Issue** | Processing 4 variants in parallel can exhaust memory |
| **Status** | 🔴 Open |

---

## 🟡 Medium

### ARCH-013: No Hierarchical Category Support
| | |
|---|---|
| **File** | Database schema |
| **Issue** | No `parent_id` field for nested categories |
| **Status** | 🔴 Open |

---

### ARCH-014: No Scheduled Publishing Support
| | |
|---|---|
| **File** | `schemas.ts:18`, `post.service.ts` |
| **Issue** | `published_at` exists but no scheduling logic |
| **Status** | 🔴 Open |

---

### ARCH-015: Presigned URL Expiration Not Configurable
| | |
|---|---|
| **File** | `storage.service.ts:128-150` |
| **Issue** | Fixed 600-second expiration for all uploads |
| **Status** | 🔴 Open |

---

### ARCH-016: No Retry Mechanism for Failed Processing
| | |
|---|---|
| **File** | `media-processor.ts:88-93` |
| **Issue** | Failed media stays in 'failed' state forever |
| **Status** | 🔴 Open |

---

### ARCH-017: Frontend Progress Tracking Key Collision
| | |
|---|---|
| **File** | `use-media.ts:23-48` |
| **Issue** | Filename used as key, collision with same name files |
| **Status** | 🔴 Open |

---

### ARCH-018: No Auto-Calculation of read_time_minute
| | |
|---|---|
| **File** | `post.service.ts` |
| **Issue** | Field passed through but never calculated |
| **Status** | ✅ Fixed — `extractTextFromTipTap()` + `calculateReadTime()` helpers; auto-calculated on create/update (`3d5992d`) |

---

## 🟢 Low

### ARCH-019: Inconsistent API Response Naming
| | |
|---|---|
| **File** | `server.ts:668-678`, `server.ts:899-906` |
| **Issue** | Mix of snake_case and camelCase |
| **Status** | ✅ Fixed — All admin API responses standardized to snake_case (`6919924`) |

---

### ARCH-020: Default Pagination Limit Too Small
| | |
|---|---|
| **File** | `category.service.ts:156` |
| **Issue** | Default of 10 too restrictive for admin interface |
| **Status** | 🔴 Open |
