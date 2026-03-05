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
| [007](./007-strapi-to-custom-cms-migration.md) | Migration from Strapi to Custom CMS | Accepted | 2026-02-22 |
| [008](./008-sst-removal.md) | Removal of SST Deployment Infrastructure | Accepted | 2026-02-22 |
| [009](./009-database-migration-strategy.md) | Database Migration Strategy with dbmate | Accepted | 2026-02-21 |
| [010](./010-unified-api-client.md) | Unified API Client Architecture | Accepted | 2026-02-24 |
| [011](./011-gallery-ordering-strategy.md) | Gallery Image Ordering and Resolution Strategy | Accepted | 2026-02-24 |
| [012](./012-async-debounced-webhook.md) | Asynchronous Debounced Webhook Deployment | Accepted | 2026-03-05 |

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

### ADR-007: Migration from Strapi to Custom CMS

**Decision:** Complete migration from Strapi to the custom CMS built with Effect TS and Bun.

**Key Benefits:**
- Zero cold starts vs 5-10 seconds with Lambda
- Lower resource usage (~50MB vs 300-500MB RAM)
- Simpler NixOS deployment with single binary
- Full control over the entire stack

### ADR-008: Removal of SST Deployment Infrastructure

**Decision:** Remove all SST-related configuration and migrate to NixOS deployment.

**Key Benefits:**
- Faster CI/CD (no SST builds)
- ~270 fewer packages in lockfile
- No AWS complexity (CloudFormation, IAM, Lambda)
- Lower infrastructure costs

### ADR-009: Database Migration Strategy with dbmate

**Decision:** Use dbmate for SQL-based database migrations with CI/CD integration.

**Key Benefits:**
- Explicit SQL migrations tracked in git
- Automatic deployment via SSH tunnel
- Language-agnostic (works with any stack)
- Simple rollback capability

### ADR-010: Unified API Client Architecture

**Decision:** Create centralized API client for the Astro frontend with shared types and consistent error handling.

**Key Benefits:**
- DRY principle - single `cmsFetch` utility
- Consistent error handling across all API calls
- Type-safe shared types prevent drift
- Clean migration from Strapi to custom CMS format

### ADR-011: Gallery Image Ordering and Resolution Strategy

**Decision:** Use array position for image ordering with dual API models (structured entries for admin, resolved media for public).

**Key Benefits:**
- No database migration required
- Clean separation of admin vs public API needs
- First-image-as-cover convention
- Synthetic IDs for React rendering

### ADR-012: Asynchronous Debounced Webhook Deployment

**Decision:** Implement queue-based, debounced webhook system using Effect.Queue with 5-minute debounce window.

**Key Benefits:**
- Non-blocking API responses (content mutations return immediately)
- Deploy debouncing (batches rapid changes into single deploy)
- Rate limit protection (max 1 deploy per 5 minutes)
- Fault tolerant with auto-restarting daemon worker

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
