# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the ivokun.com CMS project.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences. ADRs help future maintainers understand why certain decisions were made.

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](./001-cms-architecture.md) | Custom CMS Architecture | Accepted | 2025-01-06 |
| [002](./002-effect-ts-adoption.md) | Effect TS Adoption for Backend | Accepted | 2025-01-06 |
| [003](./003-admin-spa-technology.md) | SolidJS for Admin SPA | Accepted | 2025-01-06 |
| [004](./004-image-processing-pipeline.md) | Image Processing Pipeline | Accepted | 2025-01-06 |
| [005](./005-authentication-strategy.md) | Authentication Strategy | Accepted | 2025-01-06 |
| [006](./006-bun-workspace-configuration.md) | Bun Workspace Configuration | Accepted | 2025-01-07 |

## Summary

### ADR-001: Custom CMS Architecture

**Decision:** Build a custom headless CMS with Bun, Effect TS, Kysely, and SolidJS instead of continuing with Strapi.

**Key Drivers:**
- Single binary deployment for NixOS
- Lower resource usage (<256MB RAM)
- Full control over codebase
- Type-safe end-to-end

### ADR-002: Effect TS Adoption

**Decision:** Use Effect TS 3.x for all backend services.

**Key Benefits:**
- Typed errors that compiler enforces
- Service layer with dependency injection
- Resource management with finalizers
- Composable async operations

### ADR-003: SolidJS for Admin SPA

**Decision:** Use SolidJS instead of React/Vue for the admin interface.

**Key Benefits:**
- Small bundle size (~80KB gzipped)
- Fine-grained reactivity
- Familiar JSX syntax
- Fast development with Vite

### ADR-004: Image Processing Pipeline

**Decision:** Process all uploads into 4 WebP variants (original, thumbnail, small, large).

**Key Benefits:**
- Optimized delivery with WebP
- Responsive images for different devices
- CDN-friendly static URLs
- Consistent format

### ADR-005: Authentication Strategy

**Decision:** Dual authentication with session cookies for admin and API keys for public API.

**Key Benefits:**
- Secure password hashing with Argon2id
- Session revocation capability
- API key tracking
- CSRF/XSS protection

### ADR-006: Bun Workspace Configuration

**Decision:** Standardize on Bun workspaces with per-package `bunfig.toml` configuration.

**Key Benefits:**
- Single package manager across all packages
- Parallel builds with `bun --filter`
- Proper Effect TS module resolution
- Independent package builds

## ADR Template

When creating new ADRs, use this template:

```markdown
# ADR-XXX: Title

> **Status:** Proposed | Accepted | Deprecated | Superseded  
> **Date:** YYYY-MM-DD  
> **Deciders:** Names  
> **Related:** ADR-XXX (if applicable)

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

### Positive
- List benefits

### Negative
- List drawbacks

### Neutral
- List tradeoffs

## Alternatives Considered

### 1. Alternative Name
**Rejected because:** Reason

## References

- Links to relevant documentation
```

## Related Documents

- [CMS PRD](../plans/cms-prd.md) - Product Requirements Document
- [Implementation Plan](../plans/cms-implementation-plan.md) - Phased implementation plan
- [AGENTS.md](../../AGENTS.md) - Development guidelines
