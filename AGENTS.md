# AGENTS.md - Guidance for Coding Agents

> **Context:** This is a monorepo built with Bun, Astro, Hono, and Effect TS.
> **Primary Goal:** Maintain high code quality, strict typing, and deployment stability.

## 1. Build, Lint & Test Commands

### Root / Global
- **Type Check:** `bun run typecheck` (Checks all packages)
- **Database Migrations (Root):** `bun run db:up` (using dbmate)
- **Docker:** `bun run docker:up` / `bun run docker:down`

### Web (Astro + React)
- **Dev Server:** `bun --filter web dev`
- **Build:** `bun --filter web build`
- **Check:** `bun --filter web astro check`

### CMS (Effect TS + Kysely + SolidJS)
- **Dev Server:** `bun --filter '@ivokundotcom/cms' dev` (Runs server + SPA)
- **Dev Server Only:** `bun --filter '@ivokundotcom/cms' dev:server`
- **Dev SPA Only:** `bun --filter '@ivokundotcom/cms' dev:spa`
- **Build Binary:** `bun --filter '@ivokundotcom/cms' build`
- **Build SPA:** `bun --filter '@ivokundotcom/cms' build:spa`
- **Type Check:** `bun --filter '@ivokundotcom/cms' typecheck`
- **Lint:** `bun --filter '@ivokundotcom/cms' lint`
- **Format:** `bun --filter '@ivokundotcom/cms' format`
- **Test All:** `bun --filter '@ivokundotcom/cms' test`
- **Test Single File:** `cd cms && bun test src/services/post.service.test.ts`
- **Test Watch:** `cd cms && bun test --watch`
- **Migrations:** `bun --filter '@ivokundotcom/cms' db:up`
- **Seed Admin:** `bun --filter '@ivokundotcom/cms' seed:admin`

## 2. Code Style & Conventions

### General Guidelines
- **Package Manager:** Use `bun` (v1.1.38+) exclusively. NEVER use npm/yarn/pnpm.
- **Node Engine:** Requires Node.js >=22.17.0.
- **Lockfile:** Always commit `bun.lock`.
- **Secrets:** Never commit `.env` files.

### Formatting (Prettier)
- **Single Quotes:** Always use single quotes.
- **Trailing Commas:** Use `es5` style.
- **Print Width:** 100 characters.
- **Tab Width:** 2 spaces (never tabs).
- **Arrow Parens:** Always include (e.g., `(x) => x`).
- **End of Line:** LF (`\n`).

### Linting
- **Import Sorting:** Imports MUST be sorted using `simple-import-sort` plugin.
- **Parser:** Uses `@typescript-eslint/parser` for TS/TSX.
- **Astro:** Uses `astro-eslint-parser` for `.astro` files.

### TypeScript Rules
- **Strict Mode:** Enabled (extends `@tsconfig/node22`).
- **No Emit:** `tsc --noEmit` is used for checking; Bun/Esbuild/Vite handles emission.
- **Types:**
  - Use `interface` for object definitions (extensible).
  - Use `type` for unions/intersections.
  - Avoid `any`. Use `unknown` or distinct types.
- **Path Aliases:**
  - CMS: `~/*` maps to `./src/*`
  - Web: `@components/*`, `@layouts/*`, `@api/*`, `@utils/*`

### Effect TS Patterns (CMS)
- **Error Handling:** Avoid `try/catch`. Use `Effect.try`, `Effect.fail`, and `Effect.catchTag`.
- **Services:** Define services using `Context.Tag` (e.g., `class PostService extends Context.Tag('PostService')<...>()`).
- **Schemas:** Use `@effect/schema` for runtime validation (API requests/responses, DB models).
- **Pipelines:** Use `pipe()` for composition.
- **Error Types:** Define errors using `Data.TaggedError()` (see `src/errors.ts`).
- **Layers:** Use `Layer` for service composition and dependency injection.

### Naming Conventions
- **Variables/Functions:** `camelCase` (e.g., `getUser`, `isValid`).
- **Components/Classes:** `PascalCase` (e.g., `UserProfile`, `AuthService`).
- **Files:** `kebab-case` (e.g., `auth-service.ts`, `user-profile.tsx`).
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`).
- **Effect Tags:** Use PascalCase matching the service name.

### Project Structure
- **`web/`**: Astro frontend with React islands.
- **`cms/`**: Standalone CMS binary using Kysely (Postgres) and SolidJS admin panel.
- **`infra/`**: Terraform infrastructure definitions.
- **`docs/adr/`**: Architecture Decision Records.

### Workspace Configuration
Each package has its own `bunfig.toml` for proper module resolution:

| Package | Name | Filter |
|---------|------|--------|
| web | `web` | `bun --filter web` |
| cms | `@ivokundotcom/cms` | `bun --filter '@ivokundotcom/cms'` |

See [ADR-006](./docs/adr/006-bun-workspace-configuration.md) for details.

## 3. Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1.  **File Issues:** Create issues for any incomplete work or tech debt introduced.
2.  **Quality Gates:**
    - Run `bun run typecheck` at root.
    - Run tests for modified packages (e.g., `bun --filter '@ivokundotcom/cms' test`).
    - Run lint checks (e.g., `bun --filter '@ivokundotcom/cms' lint`).
3.  **Commit & Push:**
    - **Rebase First:** `git pull --rebase`
    - **Push:** `git push`
    - **Verify:** `git status` must show "up to date with origin".
4.  **Clean Up:** Remove temporary files, stashes, or dead branches.

**CRITICAL RULES:**
- **Never** stop before pushing. Local work is lost work.
- **Never** say "ready to push" without doing it. YOU are the agent; YOU push.
- **Retry** if push fails (network, conflicts). Resolve it.

## 4. Dependencies & Security

- **Secrets:** Never commit `.env` files.
- **Dependencies:** Install new packages with `bun add` (or `bun add -d` for dev).
- **Lockfile:** Always commit `bun.lock`.
