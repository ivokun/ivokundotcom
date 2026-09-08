# ADR-013: Post-mortem — May 2026 Empty-Body 500 Incidents

> **Status:** Accepted
> **Date:** 2026-08-31
> **Deciders:** ivokun
> **Related:** ADR-002 (Effect TS Adoption), commits `3cf8cb1`–`47480bf`

## Incident

Static generation builds on Cloudflare Pages broke because every `/api/*` response under failure conditions came back as **500 with an empty body** (no JSON at all), so the frontend build had nothing to parse. Debugging over `3cf8cb1` → `f002fb6` → `c702f10` → `59a07d8` → `0245cff` → `c1a366e` (`47480bf` is a related CSP fix from the same window) progressed by bisection: hardcoding a route response, then disabling all public router middleware, until the failing layer was isolated.

## Root Causes (two, independent)

### 1. Defects bypassed the error handler

`apiKeyMiddleware` / `sessionMiddleware` signalled auth failures with `Effect.die()`. Defects travel outside Effect's typed error channel, so `Effect.matchEffect`'s `onFailure` in the `errorHandler` never saw them, and `@effect/platform`'s built-in error layer converted them into a bare 500 with an empty body.

**Fix:** middleware now emits typed failures (`Effect.fail` with `Data.TaggedError` classes — `InvalidCredentials`, `InvalidApiKey`) and lets `DatabaseError` propagate as a typed failure (`3cf8cb1`). Defense in depth was added at two levels: `Effect.catchAllDefect` on the `errorHandler` (`3cf8cb1`) and router-level `HttpRouter.catchAllCause` that distinguishes `Cause.isFailType` from `Cause.isDie` and maps typed `AppError`s to proper HTTP status codes (`c1a366e`).

### 2. `--minify` corrupted Effect service identity

Bun's minifier mangled internal class/identifier structures that Effect's `Context.Tag` service identity relies on. The result was defects **only in the compiled binary** — never reproducible in dev. This is why the crash "came and went" and looked nondeterministic.

**Fix:** `--minify` removed from the deploy workflow build command (`59a07d8`) and kept out of `scripts/build-binary.ts` and the Nix package build (`cms/nix/package.nix`).

## Why debugging took the shape it did

The empty body swallowed the `Cause`, so responses carried zero diagnostic signal. The temporary hardcode (`f002fb6`) and middleware disablement (`c702f10`) were legitimate bisection steps to localize the failing layer and were reverted the same day in `59a07d8`. `0245cff` temporarily exposed defect details in the response — diagnostic only.

## Prevention Now in Place

- Expected error paths never use `Effect.die` — middleware fails with typed errors only.
- Router-level `catchAllCause` returns JSON 500 with status mapping; `errorHandler` retains `catchAllDefect` as a safety net.
- `--minify` is banned for binary builds; the deploy workflow, `build-binary.ts`, and the Nix package must stay in sync on this.

## Lesson

Effect has **three** outcome channels (success / typed failure / defect), and `@effect/platform`'s default handling converts defects into silent empty 500s. Any new middleware must fail with typed errors, and the `catchAllCause` handler must log the full defect (`Cause.pretty`) *before* masking it behind a generic JSON body.
