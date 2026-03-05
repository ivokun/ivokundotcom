import { Context, Data, Effect, Layer, Queue, Schedule } from 'effect';

// =============================================================================
// ERRORS
// =============================================================================

export class WebhookError extends Data.TaggedError('WebhookError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// SERVICE
// =============================================================================

export class WebhookService extends Context.Tag('WebhookService')<
  WebhookService,
  {
    /**
     * Trigger a Cloudflare Pages deploy hook.
     * Queues the request with debouncing (triggers at most once per 5 minutes).
     * Fails silently if no hook URL is configured.
     */
    readonly triggerDeploy: () => Effect.Effect<void, never>;
  }
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

const DEBOUNCE_DELAY = 5 * 60 * 1000; // 5 minutes in milliseconds

export const makeWebhookService = Effect.gen(function* () {
  // Get deploy hook URL from environment (optional)
  const deployHookUrl = process.env['CF_DEPLOY_HOOK_URL'];

  yield* Effect.log(
    `[Webhook] Service initialized, hook URL ${deployHookUrl ? 'is set' : 'is NOT set'}`
  );

  // Create a queue for deploy requests
  const deployQueue = yield* Queue.unbounded<void>();

  // Helper to actually send the deploy hook request
  const sendDeployHook = (): Effect.Effect<void, WebhookError> =>
    Effect.gen(function* () {
      if (!deployHookUrl) {
        yield* Effect.log('[Webhook] CF_DEPLOY_HOOK_URL not set, skipping deploy trigger');
        return;
      }

      yield* Effect.log('[Webhook] Sending Cloudflare Pages deploy request...');

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(deployHookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }),
        catch: (error) => new WebhookError({ message: 'Failed to send deploy hook request', cause: error }),
      });

      if (!response.ok) {
        const body = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => 'Unknown error',
        }).pipe(Effect.orElseSucceed(() => 'Unknown error'));
        return yield* Effect.fail(
          new WebhookError({
            message: `Deploy hook failed: ${response.status} ${response.statusText} - ${body}`,
          })
        );
      }

      yield* Effect.log('[Webhook] Cloudflare Pages deploy triggered successfully');
    });

  // Debounced worker: processes queue with 5-minute debounce
  const debouncedWorker = Effect.gen(function* () {
    yield* Effect.log('[Webhook] Debounced worker started (5 minute debounce)');

    while (true) {
      // Wait for first request
      yield* Queue.take(deployQueue);
      yield* Effect.log('[Webhook] Deploy request received, starting debounce timer...');

      // Debounce loop: keep taking while requests come in, reset timer
      let shouldTrigger = false;
      let lastRequestTime = yield* Effect.sync(() => Date.now());

      while (true) {
        const timeSinceLastRequest = yield* Effect.sync(() => Date.now() - lastRequestTime);
        const timeToWait = Math.max(0, DEBOUNCE_DELAY - timeSinceLastRequest);

        if (timeToWait === 0) {
          // Debounce period expired, time to trigger
          shouldTrigger = true;
          break;
        }

        // Race between: receiving another request vs timer expiring
        const result = yield* Effect.race(
          Queue.take(deployQueue).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                lastRequestTime = Date.now();
              })
            ),
            Effect.map(() => 'request' as const)
          ),
          Effect.sleep(timeToWait).pipe(Effect.map(() => 'timeout' as const))
        );

        if (result === 'timeout') {
          shouldTrigger = true;
          break;
        }
        // If 'request', continue the loop (timer resets implicitly)
        yield* Effect.log('[Webhook] Another request received, resetting debounce timer');
      }

      if (shouldTrigger) {
        yield* sendDeployHook().pipe(
          Effect.catchAll((error) => Effect.logWarning(`[Webhook] Deploy failed: ${error.message}`))
        );
      }
    }
  });

  // Start the worker in the background
  yield* debouncedWorker.pipe(
    Effect.catchAll((error) => Effect.logError(`[Webhook] Worker crashed: ${error}`)),
    Effect.retry({ schedule: Schedule.spaced('5 seconds') }), // Restart after 5 seconds if crashes
    Effect.forkDaemon // Run as daemon fiber (survives request handling)
  );

  // Public API: offer to queue (never blocks, never fails)
  const triggerDeploy = (): Effect.Effect<void, never> =>
    Queue.offer(deployQueue, void 0).pipe(
      Effect.tap(() => Effect.log('[Webhook] Deploy request queued')),
      Effect.catchAll((error) => Effect.logError(`[Webhook] Failed to queue deploy: ${error}`)),
      Effect.asVoid
    );

  return {
    triggerDeploy,
  };
});

export const WebhookServiceLive = Layer.effect(WebhookService, makeWebhookService);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Helper to trigger deploy without blocking the caller.
 * Uses a debounced queue (5 minutes) to batch rapid changes.
 */
export const triggerDeployAndLog = (webhookService: typeof WebhookService.Service) =>
  webhookService.triggerDeploy();
