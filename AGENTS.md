# AGENTS.md - Guidance for Coding Agents

## Build/Lint/Test Commands

- Root: `bun run typecheck` - TypeScript type checking across all packages
- Root: `bun run dev` - Start SST development environment
- Root: `bun run build` - Build all services
- Web: `bun --filter web dev` - Start Astro dev server
- Web: `bun --filter web build` - Build Astro site
- API Hono: `bun --filter api-hono dev` - Start Hono API server with DynamoDB
- API Hono: `bun --filter api-hono test` - Run all tests with Vitest
- API Hono: `bun --filter api-hono test <filename>` - Run single test file
- API Hono: `bun --filter api-hono test:watch` - Run tests in watch mode
- API Hono: `bun --filter api-hono lint` - ESLint for TypeScript files

## Code Style Guidelines

- **Package Manager**: Use bun (v1.1.38+) exclusively, never npm, yarn, or pnpm
- **Node Version**: Requires Node.js >=22.17.0 (specified in engines and volta)
- **Bun Version**: Requires bun >=1.1.38
- **Formatting**: Use Prettier with singleQuote enabled
- **Imports**: MUST be sorted using `simple-import-sort` ESLint plugin - this is enforced
- **TypeScript**: Strict typing, extends @tsconfig/node22, use `noEmit: true` for type checking
- **Error Handling**: Use try/catch blocks with typed errors; in api-hono, prefer Effect.ts error handling
- **Naming**: camelCase for variables/functions, PascalCase for components/types/classes
- **Astro Components**: Follow Astro patterns in web/src/components and web/src/pages
- **React**: Only use within Astro components for interactive UI (not standalone React apps)
- **API Structure**: api-hono uses Hono + Effect.ts + DynamoDB/ElectroDB patterns
