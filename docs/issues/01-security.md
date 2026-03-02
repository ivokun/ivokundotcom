# Security Issues

**Total Issues:** 22  
**Critical:** 8 | **High:** 9 | **Medium:** 4 | **Low:** 1

---

## 🔴 Critical

### SEC-001: CORS Wildcard Allowed in Production
| | |
|---|---|
| **File** | `config.ts:27`, `server.ts:121` |
| **Issue** | CORS defaults to `'*'` allowing any origin to access the API |
| **Risk** | CSRF attacks, credential theft, unauthorized API access |
| **Fix** | Change default based on environment; add validation |
| **Status** | ⚠️ Partial — CORS warns in production but no hard enforcement (`e4b4794`) |

**Current Code:**
```typescript
const corsOrigin = yield* Config.string('CORS_ORIGIN').pipe(Config.withDefault('*'));
```

**Recommended Fix:**
```typescript
const corsOrigin = yield* Config.string('CORS_ORIGIN').pipe(
  Config.withDefault(isDevelopment ? '*' : 'https://yourdomain.com')
);
// Add validation
Assert.isTrue(
  corsOrigin !== '*' || isDevelopment,
  'Wildcard CORS not allowed in production'
)
```

---

### SEC-002: Missing Content Security Policy Headers
| | |
|---|---|
| **File** | `server.ts:240-255` |
| **Issue** | No CSP headers defined - vulnerable to XSS attacks |
| **Risk** | XSS attacks, data injection, clickjacking |
| **Status** | ✅ Fixed — `e4b4794` |

**Recommended Fix:**
```typescript
result = HttpServerResponse.setHeader(
  result,
  'Content-Security-Policy',
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
);
result = HttpServerResponse.setHeader(result, 'X-DNS-Prefetch-Control', 'off');
result = HttpServerResponse.setHeader(result, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
```

---

### SEC-003: No Rate Limiting on Public/Admin APIs
| | |
|---|---|
| **File** | `server.ts:288-392`, `server.ts:466-993` |
| **Issue** | Only `/admin/api/login` has rate limiting |
| **Risk** | DDoS, brute force attacks, resource exhaustion |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** `adminWriteRateLimitMiddleware` (60/min) and `publicApiRateLimitMiddleware` (100/min) added; applied to admin and public routers

**Recommended Fix:**
```typescript
const publicRouter = HttpRouter.empty.pipe(
  HttpRouter.use(apiRateLimitMiddleware),
  // ... routes
);
```

---

### SEC-004: No Request Body Size Limits
| | |
|---|---|
| **File** | `server.ts:1119` |
| **Issue** | No limit on request body size |
| **Risk** | DoS via large payloads, memory exhaustion |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** `maxRequestBodySize: 10MB` added to `BunHttpServer.layer`

**Recommended Fix:**
```typescript
const ServerLive = BunHttpServer.layer({
  port: PORT,
  maxBodySize: 10 * 1024 * 1024, // 10MB
});
```

---

### SEC-005: MIME Type Validation Bypass
| | |
|---|---|
| **File** | `media.service.ts:22-28` |
| **Issue** | File extension not validated against claimed MIME type |
| **Risk** | Malicious file uploads with spoofed content types |
| **Status** | ✅ Fixed — MIME allowlist + 50MB size limit via `AllowedMimeType` schema (`90c9dc3`) |

**Recommended Fix:**
```typescript
const EXTENSION_MAP: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

const validateMimeTypeMatch = (filename: string, contentType: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return (EXTENSION_MAP[contentType] || []).includes(ext);
};
```

---

### SEC-006: No File Content Validation (Magic Numbers)
| | |
|---|---|
| **File** | `media-processor.ts:60-94` |
| **Issue** | Trusts client-provided MIME type without content validation |
| **Risk** | Malicious files (SVG with scripts, polyglots) can bypass validation |
| **Status** | ✅ Fixed — Magic bytes validation in media-processor (`90c9dc3`) |

**Recommended Fix:**
```typescript
import { fileTypeFromBuffer } from 'file-type';

const type = await fileTypeFromBuffer(buffer);
if (!type || !ALLOWED_MIME_TYPES.includes(type.mime)) {
  throw new Error(`Invalid file type: ${type?.mime || 'unknown'}`);
}
```

---

### SEC-007: No CSRF Protection
| | |
|---|---|
| **File** | `server.ts`, `middleware.ts` |
| **Issue** | No CSRF tokens for state-changing operations |
| **Risk** | Attackers could trick admins into performing unwanted actions |
| **Status** | 🔴 Open |

**Recommended Fix:**
```typescript
export const csrfMiddleware = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (['GET', 'HEAD'].includes(request.method)) return yield* app;
    
    const csrfToken = request.headers['x-csrf-token'];
    const session = yield* UserContext;
    
    if (csrfToken !== session.csrfToken) {
      return yield* HttpServerResponse.json(
        { error: 'InvalidCSRFToken' },
        { status: 403 }
      );
    }
    return yield* app;
  })
);
```

---

### SEC-008: Session Cookie Missing __Host- Prefix
| | |
|---|---|
| **File** | `server.ts:411-414` |
| **Issue** | Cookie doesn't use `__Host-` prefix |
| **Risk** | Cookie could be overridden by subdomains |
| **Status** | ✅ Fixed — `e4b4794` |

**Recommended Fix:**
```typescript
const cookieName = isProduction ? '__Host-session' : 'session';
const cookieValue = `${cookieName}=${session.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${isProduction ? '; Secure' : ''}`;
```

---

## 🟠 High

### SEC-009: DatabaseError Can Expose Internal Details
| | |
|---|---|
| **File** | `server.ts:261-282` |
| **Issue** | Error logging may leak connection strings, queries |
| **Risk** | Sensitive information exposure |
| **Status** | ✅ Fixed — `e4b4794` |

**Recommended Fix:**
```typescript
const errorId = crypto.randomUUID();
console.error(JSON.stringify({
  level: 'error',
  errorId,
  message: error instanceof Error ? error.message : 'Unknown error',
  stack: isDevelopment ? (error instanceof Error ? error.stack : undefined) : undefined,
}));
return HttpServerResponse.json(
  { error: 'InternalServerError', message: 'An unexpected error occurred', errorId },
  { status: 500 }
);
```

---

### SEC-010: No Storage Quotas or Per-User Limits
| | |
|---|---|
| **File** | `media.service.ts` |
| **Issue** | Any authenticated user can upload unlimited files |
| **Risk** | Storage exhaustion |
| **Status** | 🔴 Open |

---

### SEC-011: File Upload No Size Validation Before Presigned URL
| | |
|---|---|
| **File** | `server.ts:845-870` |
| **Issue** | No validation before generating presigned URL |
| **Risk** | Large file uploads, malicious content types |
| **Status** | ✅ Fixed — 50MB limit enforced in `MediaUploadInput` schema (`90c9dc3`) |

---

### SEC-012: No Session Rotation on Login
| | |
|---|---|
| **File** | `server.ts:400-414` |
| **Issue** | Existing sessions not invalidated on new login |
| **Risk** | Session fixation attacks |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** `deleteSessionsByUserId` called before `createSession` on login

---

### SEC-013: No Self-Deletion Protection
| | |
|---|---|
| **File** | `user.service.ts`, `server.ts:983-992` |
| **Issue** | Users can delete their own account |
| **Risk** | Admin lockout, no recovery mechanism |
| **Status** | ✅ Fixed — 403 returned when user attempts self-deletion (`6919924`) |

---

### SEC-014: No Password Change Functionality
| | |
|---|---|
| **File** | `user.service.ts` |
| **Issue** | No API endpoint for password change |
| **Risk** | Compromised passwords cannot be changed |
| **Status** | 🔴 Open |

---

### SEC-015: Input Sanitization Missing on Email
| | |
|---|---|
| **File** | `login.tsx`, `users.tsx` |
| **Issue** | Email inputs not trimmed before submission |
| **Risk** | Login failures due to trailing spaces |
| **Status** | 🔴 Open |

---

### SEC-016: API Key Prefix Length Inconsistency
| | |
|---|---|
| **File** | `auth.service.ts:156`, `schemas.ts:253` |
| **Issue** | Prefix length varies (8 vs 12 chars) |
| **Risk** | API key verification failures |
| **Status** | ✅ Fixed — Schema aligned to `minLength(8)/maxLength(12)`; service and middleware both extract 12 chars (`e4b4794`) |

---

### SEC-017: Health Check Exposes Database Info
| | |
|---|---|
| **File** | `server.ts:1066-1074` |
| **Issue** | `/health/db` exposes database connectivity |
| **Risk** | Information leakage |
| **Status** | ✅ Fixed — Health endpoint returns minimal response (`e4b4794`) |

---

## 🟡 Medium

### SEC-018: Rate Limiting Uses IP-Based Tracking Only
| | |
|---|---|
| **File** | `middleware.ts:36-64` |
| **Issue** | Can be bypassed with distributed attacks |
| **Status** | 🔴 Open |

---

### SEC-019: In-Memory Rate Limiter Not Scalable
| | |
|---|---|
| **File** | `middleware.ts:21-32` |
| **Issue** | Map-based storage won't work with multiple instances |
| **Status** | 🔴 Open |

---

### SEC-020: Session Doesn't Extend on Activity
| | |
|---|---|
| **File** | `middleware.ts:84-115` |
| **Issue** | Sessions expire after 7 days regardless of activity |
| **Status** | 🔴 Open |

---

### SEC-021: No Request ID for Tracing
| | |
|---|---|
| **File** | `server.ts` |
| **Issue** | No correlation ID for tracking requests |
| **Status** | 🔴 Open |

---

## 🟢 Low

### SEC-022: Alt Text Length Validation Missing
| | |
|---|---|
| **File** | `schemas.ts:357-360` |
| **Issue** | No maxLength on alt text |
| **Status** | ✅ Fixed — `52b4127` |

**Fix Details:** `Schema.maxLength(500)` added to alt text in `MediaUploadInput` and `UpdateMediaInput`
