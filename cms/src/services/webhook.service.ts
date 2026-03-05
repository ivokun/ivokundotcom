import { Context, Data, Effect, Layer } from 'effect';

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
     * Fails silently if no hook URL is configured.
     */
    readonly triggerDeploy: () => Effect.Effect<void, WebhookError>;
  }
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export const makeWebhookService = Effect.gen(function* () {
  // Get deploy hook URL from environment (optional)
  const deployHookUrl = process.env['CF_DEPLOY_HOOK_URL'];

  yield* Effect.log(`[Webhook] Service initialized, hook URL ${deployHookUrl ? 'is set' : 'is NOT set'}`);

  const triggerDeploy = (): Effect.Effect<void, WebhookError> =>
    Effect.gen(function* () {
      yield* Effect.log('[Webhook] Deploy hook triggered');

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

  return {
    triggerDeploy,
  };
});

export const WebhookServiceLive = Layer.effect(WebhookService, makeWebhookService);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Helper to trigger deploy and log any errors without failing the main operation.
 * Use this in services after successful content mutations.
 * Note: Runs synchronously to ensure deploy is triggered before response returns.
 */
export const triggerDeployAndLog = (webhookService: typeof WebhookService.Service) =>
  webhookService.triggerDeploy().pipe(
    Effect.catchAll((error) =>
      Effect.logWarning(`Deploy webhook failed: ${error.message}`).pipe(Effect.andThen(() => Effect.void))
    )
  );
