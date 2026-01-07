# ADR-006: Bun Workspace Configuration

> **Status:** Accepted  
> **Date:** 2025-01-07  
> **Deciders:** ivokun  
> **Related:** ADR-001 (Custom CMS Architecture)

## Context

The ivokun.com monorepo contains three packages:

| Package | Purpose | Framework |
|---------|---------|-----------|
| `api` | Strapi 5 CMS (legacy, being replaced) | Strapi/Node.js |
| `cms` | Custom CMS (new) | Effect TS/Bun |
| `web` | Astro frontend | Astro/Vite |

Previously, the project used a mix of package managers (pnpm references in READMEs, npm in some scripts). With the new CMS built on Bun and the decision to standardize on Bun across the entire monorepo, we needed to:

1. Establish consistent Bun workspace configuration
2. Ensure each package can be built and type-checked independently
3. Resolve module resolution issues (particularly for Effect TS packages)
4. Align TypeScript configurations across packages

### Problems Encountered

1. **Module Resolution Conflicts**: The `@effect/cluster` package (peer dependency of `@effect/platform-bun`) wasn't resolving correctly due to hoisting behavior in Bun workspaces
2. **Type Definition Mismatch**: The `cms` package referenced `bun-types` in tsconfig but had `@types/bun` installed
3. **Version Misalignment**: TipTap packages had version conflicts between `@tiptap/core@2.11.5` and transitive deps pulling `@tiptap/core@2.27.1`
4. **Missing Scripts**: The `api` package lacked a `typecheck` script, breaking the root-level `bun --filter '*' typecheck` command

## Decision

We standardized on Bun workspaces with the following configuration:

### 1. Root Workspace Configuration

```json
// package.json
{
  "packageManager": "bun@1.1.38",
  "workspaces": ["api", "web", "cms"],
  "scripts": {
    "typecheck": "bun --filter '*' typecheck"
  }
}
```

### 2. Per-Package `bunfig.toml`

Each workspace gets its own `bunfig.toml` for consistent module resolution:

```toml
# api/bunfig.toml, web/bunfig.toml, cms/bunfig.toml
[install]
registry = "https://registry.npmjs.org"

[resolve]
conditions = ["import", "module", "node"]
```

The `conditions` setting ensures proper resolution of ESM subpath exports, particularly important for Effect TS packages.

### 3. Package Naming Convention

| Package | `name` in package.json | Filter Usage |
|---------|------------------------|--------------|
| api | `api` | `bun --filter api` |
| web | `web` | `bun --filter web` |
| cms | `@ivokundotcom/cms` | `bun --filter '@ivokundotcom/cms'` |

The CMS uses a scoped name to avoid conflicts with npm's `cms` package.

### 4. TypeScript Configuration

Each package manages its own `tsconfig.json`:

| Package | Base | Types |
|---------|------|-------|
| api | Strapi defaults | Node.js |
| web | Astro defaults | Astro |
| cms | `ES2022 + bundler` | `@types/bun` |

Key fix for CMS: Changed `"types": ["bun-types"]` to `"types": ["@types/bun"]` to match the installed package.

### 5. Dependency Alignment

Dependencies that span multiple packages must have aligned versions:

```bash
# Example: TipTap packages in cms
bun add -d @tiptap/core@latest @tiptap/starter-kit@latest @tiptap/extension-image@latest
```

All TipTap packages upgraded to v3.15.1 to resolve type conflicts.

## Consequences

### Positive

1. **Consistent Tooling**: Single package manager (`bun`) across all packages
2. **Parallel Builds**: `bun --filter '*' typecheck` runs all type checks in parallel
3. **Module Resolution**: Effect TS packages resolve correctly with explicit conditions
4. **Independent Packages**: Each package can be built/tested in isolation
5. **Clear Naming**: Scoped package names prevent npm conflicts

### Negative

1. **Increased Configuration**: Three `bunfig.toml` files to maintain
2. **Filter Syntax**: Scoped packages require quotes in filter (`'@ivokundotcom/cms'`)
3. **Pre-existing Issues**: Web package has 31 pre-existing TypeScript errors unrelated to workspace setup

### Neutral

1. **Hoisting Behavior**: Some packages (like Effect) work better when not hoisted; `bunfig.toml` helps control this
2. **Lockfile**: Single `bun.lockb` at root manages all dependencies

## Migration Steps

For future packages or similar monorepos:

1. Add `bunfig.toml` to each workspace with standard resolve conditions
2. Ensure each package has a `typecheck` script
3. Use scoped names for packages that might conflict with npm
4. Align versions of shared dependencies
5. Verify with `bun --filter <name> typecheck` for each package

## Verification Commands

```bash
# Install all dependencies
bun install

# Type-check individual packages
bun --filter api typecheck
bun --filter web typecheck
bun --filter '@ivokundotcom/cms' typecheck

# Type-check all packages
bun run typecheck

# Run tests in specific package
bun --filter '@ivokundotcom/cms' test
```

## References

- [Bun Workspaces Documentation](https://bun.sh/docs/install/workspaces)
- [Bun Configuration Reference](https://bun.sh/docs/runtime/bunfig)
- [Effect TS Module Resolution](https://effect.website/docs/getting-started)
- [ADR-001: Custom CMS Architecture](./001-cms-architecture.md)
