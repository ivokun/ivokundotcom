# ADR-007: Migration from Strapi to Custom CMS

> **Status:** Accepted  
> **Date:** 2026-02-22  
> **Deciders:** ivokun  
> **Supersedes:** Strapi API (completes ADR-001)

## Context

The project began with Strapi 5 as the headless CMS, deployed on AWS Lambda with SST. While Strapi provided a working solution, operational pain points accumulated over time:

1. **Cold Start Latency** - 5-10 second Lambda cold starts affected user experience
2. **High Memory Usage** - 300-500MB RAM at idle was costly and inefficient
3. **Deployment Complexity** - SST + Lambda + RDS + S3 required multi-service orchestration
4. **NixOS Incompatibility** - Strapi's Node.js runtime model didn't fit declarative NixOS deployment
5. **Vendor Lock-in** - Content model changes between Strapi versions required migration work

ADR-001 (Custom CMS Architecture) proposed building a replacement. By February 2026, the custom CMS reached full feature parity and was ready to replace Strapi entirely.

## Decision

Complete the migration by removing all Strapi-related code and infrastructure:

### Components Removed

| Component | Path | Replacement |
|-----------|------|-------------|
| Strapi API | `api/` | Custom CMS (`cms/`) |
| Dockerfile | `Dockerfile` | Bun binary compilation |
| Terraform Infra | `infra/` | NixOS modules |
| DB Init Scripts | `db/init/` | dbmate migrations |
| SST Stacks | `stacks/` | GitHub Actions + SSH deploy |

### Migration Timeline

1. **Phase 1** (Jan 2025): Build custom CMS with feature parity
2. **Phase 2** (Feb 2026): Data migration from Strapi to custom CMS
3. **Phase 3** (Feb 2026): DNS cutover to new CMS
4. **Phase 4** (Feb 2026): Remove Strapi code and infrastructure

### Verification Checklist

- [x] All content migrated (posts, galleries, categories, media)
- [x] Admin functionality equivalent (CRUD, rich editor, image uploads)
- [x] Public API responses compatible
- [x] Frontend consuming new API
- [x] Old infrastructure decommissioned

## Consequences

### Positive

1. **Zero Cold Starts** - Single binary starts in <100ms
2. **Lower Resource Usage** - ~50MB RAM vs 300-500MB
3. **Simpler Deployment** - One binary + systemd service on NixOS
4. **Full Control** - Own the entire stack, no vendor dependencies
5. **Type Safety** - End-to-end TypeScript with Effect TS
6. **Faster CI/CD** - No SST builds, direct binary deployment

### Negative

1. **Maintenance Responsibility** - Must maintain custom codebase
2. **No Strapi Ecosystem** - Lost access to Strapi plugins and community
3. **Migration Effort** - One-time cost to build and migrate

### Neutral

1. **API Changes** - Minor differences in response structure (handled in web client)
2. **Admin UI** - Different but functionally equivalent interface

## Alternatives Considered

### 1. Keep Strapi Running

**Rejected because:**
- Continued operational overhead
- No path to NixOS deployment
- Persistent cold start issues

### 2. Gradual Migration (Run Both)

**Rejected because:**
- Added complexity of dual systems
- Database synchronization challenges
- No benefit over clean cutover

### 3. Use Different Headless CMS

**Rejected because:**
- Would face similar vendor lock-in issues
- Custom CMS already built and tested
- No off-the-shelf solution fits NixOS deployment model

## References

- [ADR-001: Custom CMS Architecture](./001-cms-architecture.md)
- [Commit: Remove legacy Strapi API](https://github.com/ivokun/ivokun.com/commit/54a7ce0)
- [CMS Package](../packages/cms/) - Custom CMS implementation
