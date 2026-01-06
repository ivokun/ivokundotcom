# ADR-002: Effect TS Adoption for Backend Services

> **Status:** Accepted  
> **Date:** 2025-01-06  
> **Deciders:** ivokun  
> **Related:** ADR-001 (CMS Architecture)

## Context

When building the custom CMS backend, we needed to choose a programming paradigm for handling:

1. **Async Operations** - Database queries, file uploads, image processing
2. **Error Handling** - Typed errors that propagate through the call stack
3. **Dependency Injection** - Service composition without class hierarchies
4. **Resource Management** - Connection pools, file handles, cleanup

Traditional approaches in Node.js/TypeScript include:

- **Promises + try/catch** - Untyped errors, easy to forget handling
- **Result types (fp-ts)** - Verbose, no built-in async support
- **NestJS/InversifyJS** - Heavy DI frameworks with decorators

## Decision

We adopted **Effect TS 3.x** as the foundational library for all backend services.

### Core Patterns Used

#### 1. Effect Type for All Operations

```typescript
// Every async operation returns Effect<Success, Error, Requirements>
const getPost = (id: string): Effect.Effect<Post, NotFound | DatabaseError, DbService> =>
  Effect.gen(function* () {
    const { db } = yield* DbService
    const post = yield* Effect.tryPromise({
      try: () => db.selectFrom('posts').where('id', '=', id).executeTakeFirst(),
      catch: (e) => new DatabaseError({ cause: e, operation: 'getPost' })
    })
    if (!post) {
      return yield* Effect.fail(new NotFound({ resource: 'Post', id }))
    }
    return post
  })
```

#### 2. Tagged Errors with Data.TaggedError

```typescript
// All errors are tagged unions, not thrown exceptions
export class NotFound extends Data.TaggedError('NotFound')<{
  readonly resource: string
  readonly id: string
}> {
  get message(): string {
    return `${this.resource} with id '${this.id}' not found`
  }
}

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly cause?: unknown
  readonly operation: string
}> {}

// Type-safe error handling
const result = pipe(
  getPost(id),
  Effect.catchTag('NotFound', (e) => Effect.succeed(null)),
  Effect.catchTag('DatabaseError', (e) => Effect.die(e)) // Defect, unrecoverable
)
```

#### 3. Service Pattern with Context.Tag

```typescript
// Service interface definition
export class DbService extends Context.Tag('DbService')<
  DbService,
  {
    readonly db: Kysely<Database>
    readonly query: <T>(op: string, fn: (db: Kysely<Database>) => Promise<T>) => Effect.Effect<T, DatabaseError>
  }
>() {}

// Service implementation as Layer
export const DbServiceLive = (connectionString: string) =>
  Layer.scoped(DbService, makeDbService(connectionString))

// Composition
const MainLayer = Layer.mergeAll(
  DbServiceLive(config.databaseUrl),
  StorageServiceLive(config.r2),
  AuthServiceLive,
  PostServiceLive,
)
```

#### 4. Schema Validation with @effect/schema

```typescript
// Define schema once, derive types
export const CreatePostInput = Schema.Struct({
  title: Schema.String.pipe(Schema.minLength(1)),
  slug: Slug,
  excerpt: Schema.optional(Schema.String),
  content: Schema.optional(TipTapDocument),
  locale: Schema.optional(Locale).pipe(Schema.withDefault(() => 'en' as const)),
})

export type CreatePostInput = typeof CreatePostInput.Type

// Runtime validation
const parseInput = Schema.decodeUnknown(CreatePostInput)
const validated = yield* parseInput(rawInput).pipe(
  Effect.mapError((e) => new ValidationError({ message: 'Invalid input', errors: formatErrors(e) }))
)
```

#### 5. Resource Management with Scope

```typescript
// Database connection pool with automatic cleanup
export const makeDbService = (connectionString: string) =>
  Effect.gen(function* () {
    const pool = new Pool({ connectionString, max: 20 })
    const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })

    // Register cleanup on scope close
    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        await db.destroy()
        await pool.end()
      })
    )

    return { db, query: /* ... */ }
  })
```

### Integration with HTTP Layer

Hono middleware integrates with Effect:

```typescript
// Middleware that validates session
const requireSession = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const result = await Effect.runPromise(
    pipe(
      AuthService,
      Effect.flatMap((auth) => auth.validateSession(sessionId)),
      Effect.provide(layers),
      Effect.either
    )
  )
  
  if (Either.isLeft(result)) {
    return c.json({ error: result.left._tag }, 401)
  }
  
  c.set('session', result.right)
  await next()
})
```

## Consequences

### Positive

1. **Typed Errors** - Compiler enforces error handling; impossible to forget a case
2. **Dependency Injection** - Clean service composition without decorators or reflection
3. **Testability** - Services are easily mockable by providing test layers
4. **Resource Safety** - Finalizers ensure cleanup even on errors
5. **Composability** - Effects compose naturally with `pipe`, `flatMap`, `all`
6. **Documentation** - Error types serve as documentation of failure modes

### Negative

1. **Learning Curve** - Effect has different mental model than traditional async/await
2. **Verbosity** - More boilerplate than simple Promise chains
3. **Ecosystem** - Fewer tutorials/examples compared to mainstream patterns
4. **Bundle Size** - Effect adds ~50KB to bundle (acceptable for server)

### Neutral

1. **Generator Syntax** - `Effect.gen` with `yield*` is readable but unfamiliar
2. **Type Inference** - Sometimes requires explicit type annotations
3. **Error Conversion** - Must wrap external library errors in tagged errors

## Code Examples

### Before (Traditional Async/Await)

```typescript
// Problems:
// - Error types unknown at compile time
// - Easy to forget error handling
// - Service dependencies implicit

async function createPost(data: CreatePostInput): Promise<Post> {
  const existing = await db
    .selectFrom('posts')
    .where('slug', '=', data.slug)
    .executeTakeFirst()
  
  if (existing) {
    throw new Error('Slug already exists') // Untyped error
  }
  
  return await db
    .insertInto('posts')
    .values({ id: createId(), ...data })
    .returningAll()
    .executeTakeFirstOrThrow()
}
```

### After (Effect TS)

```typescript
// Benefits:
// - Error types explicit: SlugConflict | DatabaseError
// - Dependencies declared: DbService
// - Compiler enforces handling

const createPost = (data: CreatePostInput): Effect.Effect<
  Post,
  SlugConflict | DatabaseError,
  DbService
> =>
  Effect.gen(function* () {
    const { query } = yield* DbService
    
    const existing = yield* query('checkSlug', (db) =>
      db.selectFrom('posts').where('slug', '=', data.slug).executeTakeFirst()
    )
    
    if (existing) {
      return yield* Effect.fail(new SlugConflict({ slug: data.slug }))
    }
    
    return yield* query('insertPost', (db) =>
      db.insertInto('posts')
        .values({ id: createId(), ...data })
        .returningAll()
        .executeTakeFirstOrThrow()
    )
  })
```

## Alternatives Considered

### 1. Plain Promises with Custom Result Type

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
```

**Rejected because:**
- No built-in async support
- Manual error propagation
- No dependency injection

### 2. fp-ts

**Rejected because:**
- Verbose pipe syntax for simple operations
- TaskEither doesn't handle dependencies
- Effect is the spiritual successor with better DX

### 3. neverthrow

**Rejected because:**
- Limited to Result type, no service layer
- No resource management
- Less comprehensive than Effect

### 4. NestJS with class-based DI

**Rejected because:**
- Decorator-based, requires experimental TypeScript features
- Heavy runtime overhead
- Doesn't compose well with functional patterns

## References

- [Effect TS Documentation](https://effect.website)
- [Effect Best Practices Guide](https://effect.website/docs/guides/essentials/effect-best-practices)
- [Effect Schema Documentation](https://effect.website/docs/schema/introduction)
- [Data.TaggedError API](https://effect-ts.github.io/effect/effect/Data.ts.html#TaggedError)
