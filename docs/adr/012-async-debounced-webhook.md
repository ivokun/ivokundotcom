# ADR-012: Asynchronous Debounced Webhook Deployment

> **Status:** Accepted  
> **Date:** 2026-03-05  
> **Deciders:** ivokun  
> **Related:** ADR-001 (CMS Architecture)

## Context

The CMS needs to trigger Cloudflare Pages rebuilds when content changes (posts, galleries, categories, home page). Initially, we considered several approaches:

1. **Synchronous HTTP call** - Block API response until webhook completes
2. **Forked async call** - Fire-and-forget with `Effect.fork`
3. **Queue-based with debouncing** - Batch rapid changes into single deploys

Problems encountered:
- **Synchronous**: Blocks API response, poor UX for content editors
- **Forked**: Effect fiber was interrupted before execution due to version mismatch issues
- **No debouncing**: Rapid content changes could trigger deploy spam (rate limits, wasted builds)

## Decision

Implement a **queue-based, debounced webhook system** using Effect.Queue:

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     WebhookService                              │
│                                                                 │
│  ┌──────────────────┐      ┌──────────────────────────────┐    │
│  │  Effect.Queue    │─────▶│   Debounced Worker (Daemon)  │    │
│  │  (unbounded)     │      │                              │    │
│  └──────────────────┘      │  - Takes first request       │    │
│                            │  - Starts 5-minute timer     │    │
│  ┌──────────────────┐      │  - Resets timer on new req   │    │
│  │  triggerDeploy() │─────▶│  - Sends webhook on expiry   │    │
│  │  (non-blocking)  │      │                              │    │
│  └──────────────────┘      └──────────────────────────────┘    │
│                                         │                       │
│                                         ▼                       │
│                              ┌──────────────────────┐          │
│                              │  Cloudflare Pages    │          │
│                              │  Deploy Hook         │          │
│                              └──────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Implementation Details

1. **Non-blocking API**: `triggerDeploy()` returns `Effect<void, never>`
   - Never blocks content mutation API responses
   - Never fails (errors logged internally)
   - Simply offers to queue

2. **Unbounded Queue**: `Queue.unbounded<void>()`
   - No backpressure on content operations
   - Memory-safe (queue cleared after processing)

3. **Debounced Worker**:
   - 5-minute debounce window (`DEBOUNCE_DELAY = 5 * 60 * 1000`)
   - Uses `Effect.race` between queue take and sleep
   - Timer resets on each new request during window
   - Daemon fiber (`Effect.forkDaemon`) survives request scope

4. **Error Handling**:
   - Worker auto-restarts on crash (5-second delay)
   - Webhook failures logged but don't crash worker
   - Missing `CF_DEPLOY_HOOK_URL` logged and skipped

### Code Structure

```typescript
// Service API
readonly triggerDeploy: () => Effect.Effect<void, never>

// Implementation
const deployQueue = yield* Queue.unbounded<void>()

// Public: non-blocking offer
const triggerDeploy = () =>
  Queue.offer(deployQueue, void 0)

// Private: debounced worker
const debouncedWorker = Effect.gen(function* () {
  while (true) {
    yield* Queue.take(deployQueue)  // Wait for first request
    
    // Debounce loop
    while (true) {
      const result = yield* Effect.race(
        Queue.take(deployQueue),           // New request?
        Effect.sleep(timeRemaining)         // Timer expired?
      )
      
      if (result === 'timeout') {
        yield* sendDeployHook()  // Actually trigger
        break
      }
      // Reset timer and continue loop
    }
  }
})
```

### Trigger Points

Webhooks are triggered after successful mutations in:
- `PostService` (create, update, delete)
- `CategoryService` (create, update, delete)
- `GalleryService` (create, update, delete)
- `HomeService` (update)

### Logging

| Event | Log Message |
|-------|-------------|
| Worker start | `[Webhook] Debounced worker started (5 minute debounce)` |
| Service init | `[Webhook] Service initialized, hook URL is set` |
| Request queued | `[Webhook] Deploy request queued` |
| Timer start | `[Webhook] Deploy request received, starting debounce timer...` |
| Timer reset | `[Webhook] Another request received, resetting debounce timer` |
| Hook sent | `[Webhook] Sending Cloudflare Pages deploy request...` |
| Success | `[Webhook] Cloudflare Pages deploy triggered successfully` |
| Failure | `[Webhook] Deploy failed: {message}` |

## Consequences

### Positive

1. **Fast API Responses** - Content mutations return immediately, no waiting for webhook
2. **Deploy Debouncing** - Rapid edits (e.g., saving multiple times) batch into single deploy
3. **Rate Limit Protection** - Max 1 deploy per 5 minutes, prevents Cloudflare rate limits
4. **Fault Tolerance** - Queue-based decoupling survives transient failures
5. **Observable** - Clear logging of queue state and webhook attempts
6. **Resource Efficient** - Single daemon fiber, no thread pools or external queues

### Negative

1. **Deployment Delay** - Changes may take up to 5 minutes + build time to appear
2. **Complexity** - More complex than simple HTTP call
3. **In-memory Queue** - Queue lost on server restart (acceptable for deploy triggers)
4. **No Persistence** - If server crashes during debounce window, deploy may be skipped

### Neutral

1. **Effect-specific** - Tightly coupled to Effect TS patterns (Queue, Fiber, Race)
2. **Single-instance** - Works on single server; would need Redis for multi-instance

## Alternatives Considered

### 1. Synchronous HTTP Call

**Rejected because:**
- Blocks API response (1-2 seconds)
- Poor UX for content editors
- Failure in webhook would fail content mutation

### 2. Simple Effect.fork (Fire-and-Forget)

**Rejected because:**
- Effect fiber was interrupted before execution in production
- No debouncing = deploy spam on rapid changes
- Unclear if webhook actually triggered

### 3. External Queue (Redis/Bull)

**Rejected because:**
- Adds infrastructure dependency (Redis)
- Overkill for single-instance deployment
- More operational complexity

### 4. Database-backed Queue

**Rejected because:**
- Would require polling or LISTEN/NOTIFY
- Adds database load
- Simpler to use in-memory Effect.Queue

### 5. Cloudflare Direct Integration

**Rejected because:**
- Would require Cloudflare API tokens with page permissions
- Deploy hooks are simpler (just POST to URL)
- No need for complex API integration

## References

- [Effect Queue Documentation](https://effect.website/docs/concurrency/queue)
- [Effect Fiber Documentation](https://effect.website/docs/concurrency/fibers)
- [Cloudflare Pages Deploy Hooks](https://developers.cloudflare.com/pages/configuration/deploy-hooks/)
- Implementation: `cms/src/services/webhook.service.ts`
