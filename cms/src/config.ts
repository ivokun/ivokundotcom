/**
 * @fileoverview Configuration loading and validation
 * @see PRD Appendix 16.2 - Environment Variables
 */

import { Config, ConfigError, Effect, Layer, Redacted } from 'effect';

// =============================================================================
// CONFIGURATION SCHEMA
// =============================================================================

export class AppConfig extends Effect.Service<AppConfig>()('AppConfig', {
  effect: Effect.gen(function* () {
    const port = yield* Config.number('PORT').pipe(Config.withDefault(3000));
    const nodeEnv = yield* Config.string('NODE_ENV').pipe(Config.withDefault('development'));
    const databaseUrl = yield* Config.redacted('DATABASE_URL');
    const sessionSecret = yield* Config.redacted('SESSION_SECRET');

    // R2 Configuration
    const r2AccessKeyId = yield* Config.redacted('R2_ACCESS_KEY_ID');
    const r2AccessSecret = yield* Config.redacted('R2_ACCESS_SECRET');
    const r2Endpoint = yield* Config.string('R2_ENDPOINT');
    const r2Bucket = yield* Config.string('R2_BUCKET');
    const r2PublicUrl = yield* Config.string('R2_PUBLIC_URL');

    // CORS
    const corsOrigin = yield* Config.string('CORS_ORIGIN').pipe(Config.withDefault('*'));

    return {
      port,
      nodeEnv,
      databaseUrl,
      sessionSecret,
      r2: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2AccessSecret,
        endpoint: r2Endpoint,
        bucket: r2Bucket,
        publicUrl: r2PublicUrl,
      },
      corsOrigin,
      isDevelopment: nodeEnv === 'development',
      isProduction: nodeEnv === 'production',
    };
  }),
}) {}

export const AppConfigLive = AppConfig.Default;
