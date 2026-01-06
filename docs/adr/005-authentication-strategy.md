# ADR-005: Authentication Strategy

> **Status:** Accepted  
> **Date:** 2025-01-06  
> **Deciders:** ivokun  
> **Related:** ADR-001 (CMS Architecture)

## Context

The CMS has two types of API consumers with different authentication needs:

1. **Admin Users** - Content creators using the admin SPA
2. **Public Consumers** - The blog frontend fetching published content

Requirements:
- **Security** - Protect against common attacks (brute force, session hijacking)
- **Simplicity** - No external auth providers needed
- **Stateful Admin** - Sessions for admin panel (logout capability)
- **Stateless Public** - API keys for programmatic access

## Decision

We implemented a dual authentication system:

| Consumer | Method | Storage | Expiry |
|----------|--------|---------|--------|
| Admin SPA | Session Cookie | PostgreSQL | 7 days |
| Public API | API Key Header | Hashed in PostgreSQL | Never (manual revocation) |

### Admin Authentication: Session Cookies

#### Password Hashing

Passwords are hashed using **Argon2id** (OWASP recommended):

```typescript
import { hash, verify } from '@node-rs/argon2'

const ARGON2_OPTIONS = {
  memoryCost: 65536,  // 64 MiB
  timeCost: 3,        // 3 iterations
  parallelism: 4,     // 4 threads
  outputLen: 32,      // 32 byte hash
}

const hashPassword = (password: string) => 
  Effect.promise(() => hash(password, ARGON2_OPTIONS))

const verifyPassword = (storedHash: string, password: string) =>
  Effect.promise(() => verify(storedHash, password, ARGON2_OPTIONS))
```

#### Session Management

Sessions are stored in the database with 7-day expiry:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,        -- CUID2 session token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

Login flow:

```typescript
const login = (email: string, password: string) =>
  Effect.gen(function* () {
    const { query } = yield* DbService
    
    // Find user
    const user = yield* query('findUser', (db) =>
      db.selectFrom('users')
        .selectAll()
        .where('email', '=', email.toLowerCase())
        .executeTakeFirst()
    )
    
    if (!user) {
      return yield* Effect.fail(new InvalidCredentials({ message: 'Invalid credentials' }))
    }
    
    // Verify password
    const valid = yield* verifyPassword(user.password_hash, password)
    if (!valid) {
      return yield* Effect.fail(new InvalidCredentials({ message: 'Invalid credentials' }))
    }
    
    // Create session
    const sessionId = createId()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    
    yield* query('createSession', (db) =>
      db.insertInto('sessions')
        .values({ id: sessionId, user_id: user.id, expires_at: expiresAt })
        .execute()
    )
    
    return { user, sessionId }
  })
```

#### Cookie Configuration

Session cookie is set with security attributes:

```typescript
setCookie(c, 'session', sessionId, {
  httpOnly: true,      // No JavaScript access
  secure: true,        // HTTPS only in production
  sameSite: 'Lax',     // CSRF protection
  maxAge: 7 * 24 * 60 * 60,  // 7 days
  path: '/',
})
```

#### Session Validation Middleware

```typescript
const requireSession = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, 'session')
  
  if (!sessionId) {
    return c.json({ error: 'Unauthorized', message: 'No session' }, 401)
  }
  
  const result = await Effect.runPromise(
    validateSession(sessionId).pipe(
      Effect.provide(layers),
      Effect.either
    )
  )
  
  if (Either.isLeft(result)) {
    deleteCookie(c, 'session')
    return c.json({ error: 'SessionExpired', message: result.left.message }, 401)
  }
  
  c.set('userId', result.right.userId)
  await next()
})
```

### Public API Authentication: API Keys

#### Key Format

API keys follow the format: `cms_<48 random characters>`

```typescript
const generateApiKey = () =>
  Effect.gen(function* () {
    const key = `cms_${createId()}${createId()}`  // ~48 chars
    const keyHash = yield* hashPassword(key)
    const prefix = key.substring(0, 12)  // For lookup
    
    return { key, keyHash, prefix }
  })
```

#### Storage

Only the hash is stored; the full key is shown once at creation:

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,           -- Human identifier
  key_hash TEXT NOT NULL,       -- Argon2 hash
  prefix TEXT NOT NULL,         -- First 12 chars for lookup
  last_used_at TIMESTAMPTZ,     -- Usage tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);
```

#### Validation Flow

```typescript
const validateApiKey = (providedKey: string) =>
  Effect.gen(function* () {
    const { query } = yield* DbService
    const prefix = providedKey.substring(0, 12)
    
    // Find by prefix (fast index lookup)
    const apiKey = yield* query('findApiKey', (db) =>
      db.selectFrom('api_keys')
        .select(['id', 'key_hash'])
        .where('prefix', '=', prefix)
        .executeTakeFirst()
    )
    
    if (!apiKey) {
      return yield* Effect.fail(new InvalidApiKey({ message: 'Invalid API key' }))
    }
    
    // Verify full key against hash
    const valid = yield* verifyPassword(apiKey.key_hash, providedKey)
    if (!valid) {
      return yield* Effect.fail(new InvalidApiKey({ message: 'Invalid API key' }))
    }
    
    // Update last used timestamp
    yield* query('updateUsage', (db) =>
      db.updateTable('api_keys')
        .set({ last_used_at: new Date() })
        .where('id', '=', apiKey.id)
        .execute()
    )
  })
```

#### API Key Middleware

```typescript
const requireApiKey = createMiddleware(async (c, next) => {
  const apiKey = c.req.header('X-Api-Key')
  
  if (!apiKey) {
    return c.json({ error: 'InvalidApiKey', message: 'Missing API key' }, 401)
  }
  
  const result = await Effect.runPromise(
    validateApiKey(apiKey).pipe(
      Effect.provide(layers),
      Effect.either
    )
  )
  
  if (Either.isLeft(result)) {
    return c.json({ error: 'InvalidApiKey', message: result.left.message }, 401)
  }
  
  await next()
})
```

### Route Protection

```typescript
// Public API - requires API key
app.use('/api/*', requireApiKey)
app.get('/api/posts', listPublishedPosts)
app.get('/api/posts/:slug', getPublishedPost)

// Admin API - requires session
app.use('/admin/api/*', requireSession)
app.post('/admin/api/posts', createPost)
app.put('/admin/api/posts/:id', updatePost)

// Auth endpoints - no middleware
app.post('/admin/api/login', login)
app.post('/admin/api/logout', logout)
```

## Consequences

### Positive

1. **No External Dependencies** - Self-contained auth, no Auth0/Clerk needed
2. **Secure Passwords** - Argon2id is state-of-the-art
3. **Session Revocation** - Can log out user by deleting session
4. **API Key Tracking** - `last_used_at` for auditing
5. **CSRF Protection** - SameSite=Lax cookies
6. **XSS Protection** - HttpOnly cookies

### Negative

1. **Single Admin** - No multi-user/role support (acceptable for v1)
2. **No 2FA** - Could be added later
3. **No Password Reset** - Manual DB update required (admin-only use)
4. **Session Table Growth** - Need to clean expired sessions periodically

### Neutral

1. **Server-Side Sessions** - Requires DB lookup per request (mitigated by index)
2. **No JWT** - Stateful sessions chosen over stateless tokens
3. **Manual Key Rotation** - User must generate new key and update clients

## Security Considerations

### Implemented

- **Timing-Safe Comparison** - Argon2 verify is constant-time
- **Password Hashing** - Argon2id with OWASP parameters
- **Session Fixation** - New session ID on login
- **Cookie Security** - HttpOnly, Secure, SameSite=Lax
- **API Key Hashing** - Keys never stored in plaintext

### Not Implemented (Out of Scope for v1)

- **Rate Limiting** - Can add Cloudflare rate limits
- **Account Lockout** - No brute force protection (single admin)
- **Audit Logging** - No login history
- **IP Allowlisting** - Not needed for personal blog

## Alternatives Considered

### 1. JWT Tokens for Admin

**Rejected because:**
- Cannot revoke tokens without blacklist
- Token refresh adds complexity
- No benefit for single-server deployment

### 2. OAuth2 / OpenID Connect

**Rejected because:**
- Over-engineered for single-admin blog
- Requires external provider or self-hosted server
- Additional attack surface

### 3. Basic Auth

**Rejected because:**
- Credentials sent with every request
- No session management
- Poor UX for admin panel

### 4. API Keys for Admin Too

**Rejected because:**
- No logout capability
- Key compromise harder to detect
- Sessions provide better UX

### 5. Passwordless (Magic Links)

**Rejected because:**
- Requires email service
- Additional infrastructure
- Over-engineered for single user

## Session Cleanup

Expired sessions should be cleaned periodically:

```sql
-- Run daily via cron or scheduled task
DELETE FROM sessions WHERE expires_at < NOW();
```

Or in application:

```typescript
const cleanupSessions = () =>
  Effect.gen(function* () {
    const { query } = yield* DbService
    const result = yield* query('cleanupSessions', (db) =>
      db.deleteFrom('sessions')
        .where('expires_at', '<', new Date())
        .executeTakeFirst()
    )
    console.log(`Cleaned up ${result.numDeletedRows} expired sessions`)
  })
```

## References

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Argon2 RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html)
- [@node-rs/argon2 Documentation](https://github.com/napi-rs/node-rs/tree/main/packages/argon2)
