# ADR-008: Removal of SST Deployment Infrastructure

> **Status:** Accepted  
> **Date:** 2026-02-22  
> **Deciders:** ivokun

## Context

SST (Serverless Stack) was used to deploy the Strapi API to AWS Lambda. The infrastructure included:

- Lambda function for Strapi runtime
- API Gateway for HTTP routing
- RDS PostgreSQL instance
- S3 bucket for media storage
- CloudFront distribution

With the migration to a custom CMS running on NixOS (see ADR-007), SST became obsolete. The new deployment model uses:

- Single binary compiled with Bun
- systemd service on NixOS
- Direct SSH deployment from GitHub Actions
- Cloudflare R2 for media (existing)

## Decision

Remove all SST-related configuration, dependencies, and documentation:

### Files Removed

| File/Directory | Purpose |
|----------------|---------|
| `sst.config.ts` | SST stack configuration |
| `sst.config.ts.bk` | Backup config |
| `stacks/BlogStack.ts` | Infrastructure stack definition |
| `DEPLOYMENT.md` | SST deployment documentation |
| `cdk.context.json` | CDK context |
| `api/sst-env.d.ts` | SST type declarations |
| `web/sst-env.d.ts` | SST type declarations |
| `sst-env.d.ts` | SST type declarations |

### Dependencies Removed

```json
{
  "sst": "^2.x",
  "aws-cdk-lib": "^2.x",
  "constructs": "^10.x"
}
```

### Scripts Removed

```json
{
  "sst:deploy": "sst deploy",
  "sst:remove": "sst remove"
}
```

## Consequences

### Positive

1. **Faster CI/CD** - No SST builds (which required Docker and took 5-10 minutes)
2. **Simpler Dependencies** - ~270 fewer packages in lockfile
3. **No AWS Complexity** - No CloudFormation stacks, IAM roles, or Lambda configuration
4. **Lower Cost** - No API Gateway, Lambda, or RDS costs
5. **Predictable Deploys** - Binary + systemd is simpler than serverless orchestration

### Negative

1. **Self-Managed Infrastructure** - Must maintain NixOS server
2. **No Auto-Scaling** - Manual capacity planning vs Lambda's automatic scaling
3. **Single Point of Failure** - One server vs distributed Lambda functions

### Neutral

1. **Different Monitoring** - systemd logs instead of CloudWatch
2. **Manual SSL Management** - NixOS handles certificates via ACME

## Alternatives Considered

### 1. Keep SST for Other Services

**Rejected because:**
- No other services required serverless deployment
- Added complexity without benefit
- NixOS deployment is preferred for all services

### 2. Migrate to AWS CDK Directly

**Rejected because:**
- Still requires AWS infrastructure
- Doesn't align with NixOS self-hosting goal
- More complex than necessary

### 3. Use Other Serverless Frameworks

**Rejected because:**
- Same vendor lock-in concerns as SST
- Custom CMS works better on persistent infrastructure
- Binary deployment is simpler than container/serverless

## References

- [Commit: Remove all SST resources](https://github.com/ivokun/ivokun.com/commit/76264e8)
- [ADR-007: Migration from Strapi to Custom CMS](./007-strapi-to-custom-cms-migration.md)
- [NixOS Deployment Documentation](https://nixos.org/manual/nixos/stable/)
