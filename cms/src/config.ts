/**
 * @fileoverview Configuration loading and validation
 * @see PRD Appendix 16.2 - Environment Variables
 */

import { Config, Effect } from 'effect';

// =============================================================================
// CONFIGURATION SCHEMA
// =============================================================================

export class AppConfig extends Effect.Service<AppConfig>()('AppConfig', {
  effect: Effect.gen(function* () {
    const port = yield* Config.number('PORT').pipe(Config.withDefault(3000));
    const nodeEnv = yield* Config.string('NODE_ENV').pipe(Config.withDefault('development'));
    const databaseUrl = yield* Config.redacted('DATABASE_URL');
    const sessionSecret = yield* Config.redacted('SESSION_SECRET');
    const dbPoolMax = yield* Config.number('DB_POOL_MAX').pipe(Config.withDefault(20));

    // R2 Configuration
    const r2AccessKeyId = yield* Config.redacted('R2_ACCESS_KEY_ID');
    const r2AccessSecret = yield* Config.redacted('R2_ACCESS_SECRET');
    const r2Endpoint = yield* Config.string('R2_ENDPOINT');
    const r2Bucket = yield* Config.string('R2_BUCKET');
    const r2PublicUrl = yield* Config.string('R2_PUBLIC_URL');

    // CORS
    const isDevelopment = nodeEnv === 'development';
    const isProduction = nodeEnv === 'production';
    const corsOrigin = yield* Config.string('CORS_ORIGIN').pipe(
      Config.withDefault(isDevelopment ? '*' : '')
    );

    if (isProduction && (!corsOrigin || corsOrigin === '*')) {
      yield* Effect.logWarning(
        'CORS_ORIGIN is not set or set to wildcard (*) in production. ' +
          'This allows any origin to access the API. ' +
          'Set CORS_ORIGIN to your production domain (e.g. https://yourdomain.com).'
      );
    }

    return {
      port,
      nodeEnv,
      databaseUrl,
      sessionSecret,
      dbPoolMax,
      r2: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2AccessSecret,
        endpoint: r2Endpoint,
        bucket: r2Bucket,
        publicUrl: r2PublicUrl,
      },
      corsOrigin,
      isDevelopment,
      isProduction,
    };
  }),
}) {}

export const AppConfigLive = AppConfig.Default;
