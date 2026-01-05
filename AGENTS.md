# AGENTS.md - Guidance for Coding Agents

> **Context:** This is a monorepo built with Bun, SST, Astro, Hono, and Effect TS.
> **Primary Goal:** Maintain high code quality, strict typing, and deployment stability.

## 1. Build, Lint & Test Commands

### Root / Global
- **Type Check:** `bun run typecheck` (Checks all packages)
- **Dev Environment:** `bun run dev` (Starts SST dev environment)
- **Deploy:** `bun run deploy` (Deploys via SST)
- **Database Migrations (Root):** `bun run db:up` (using dbmate)

### Web (Astro + React)
- **Dev Server:** `bun --filter web dev`
- **Build:** `bun --filter web build`
- **Check:** `bun --filter web astro check`

### CMS (Effect TS + Kysely + SolidJS)
- **Dev Server:** `cd cms && bun run dev` (Runs `src/server.ts`)
- **Build Binary:** `cd cms && bun run build` (Compiles to single binary)
- **Build SPA:** `cd cms && bun run build:spa` (Vite build)
- **Test All:** `cd cms && bun test` (Bun native test runner)
- **Test Single File:** `cd cms && bun test <filename>`
- **Migrations:** `cd cms && bun run db:up`
- **Seed Admin:** `cd cms && bun run seed:admin`

## 2. Code Style & Conventions

### General Guidelines
- **Package Manager:** Use `bun` (v1.1.38+) exclusively. NEVER use npm/yarn/pnpm.
- **Node Engine:** Requires Node.js >=22.17.0.
- **Formatting:** Prettier with `singleQuote: true`.
- **Linting:** ESLint is strict. Imports MUST be sorted using `simple-import-sort`.

### TypeScript Rules
- **Strict Mode:** enabled (extends `@tsconfig/node22`).
- **No Emit:** `tsc --noEmit` is used for checking; Bun/Esbuild/Vite handles emission.
- **Types:**
  - Use `interface` for object definitions (extensible).
  - Use `type` for unions/intersections.
  - Avoid `any`. Use `unknown` or distinct types.

### Effect TS Patterns (CMS)
- **Error Handling:** Avoid `try/catch`. Use `Effect.try`, `Effect.fail`, and `Effect.catchTag`.
- **Services:** Define services using `Context.Tag`.
- **Schemas:** Use `@effect/schema` for runtime validation (API requests/responses, DB models).
- **Pipelines:** Use `pipe()` for composition.

### Naming Conventions
- **Variables/Functions:** `camelCase` (e.g., `getUser`, `isValid`).
- **Components/Classes:** `PascalCase` (e.g., `UserProfile`, `AuthService`).
- **Files:** `kebab-case` (e.g., `auth-service.ts`, `user-profile.tsx`).
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`).

### Project Structure
- **`web/`**: Astro frontend with React islands.
- **`cms/`**: Standalone CMS binary using Kysely (Postgres) and SolidJS admin panel.
- **`infra/`**: SST infrastructure definitions.

<!-- effect-solutions:start -->
## Effect Best Practices

**Before implementing Effect features**, run `effect-solutions list` and read the relevant guide.

Topics include: services and layers, data modeling, error handling, configuration, testing, HTTP clients, CLIs, observability, and project structure.

**Effect Source Reference:** `~/.local/share/effect-solutions/effect`
Search here for real implementations when docs aren't enough.
<!-- effect-solutions:end -->

## 3. Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1.  **File Issues:** Create issues for any incomplete work or tech debt introduced.
2.  **Quality Gates:**
    - Run `bun run typecheck` at root.
    - Run tests for modified packages (e.g., `bun --filter cms test`).
    - Run lint checks (e.g., `bun --filter cms lint`).
3.  **Commit & Push:**
    - **Rebase First:** `git pull --rebase`
    - **Sync Issues:** `bd sync` (if using beads)
    - **Push:** `git push`
    - **Verify:** `git status` must show "up to date with origin".
4.  **Clean Up:** Remove temporary files, stashes, or dead branches.

**CRITICAL RULES:**
- **Never** stop before pushing. Local work is lost work.
- **Never** say "ready to push" without doing it. YOU are the agent; YOU push.
- **Retry** if push fails (network, conflicts). Resolve it.

## 4. Dependencies & Security

- **Secrets:** Never commit `.env` files. Use `sst-env.d.ts` for type-safe environment variables in SST apps.
- **Dependencies:** Install new packages with `bun add` (or `bun add -d` for dev).
- **Lockfile:** Always commit `bun.lockb`.
