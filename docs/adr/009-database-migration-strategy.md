# ADR-009: Database Migration Strategy with dbmate

> **Status:** Accepted  
> **Date:** 2026-02-21  
> **Deciders:** ivokun

## Context

The custom CMS requires a reliable database migration system that:

1. **Works with Kysely** - Our query builder doesn't include migrations
2. **Integrates with CI/CD** - Must run automatically on deployment
3. **Supports SSH tunneling** - Production DB is behind firewall
4. **Handles existing schemas** - Must mark initial schema as applied without re-running
5. **Simple and reliable** - No complex ORM migration frameworks

The previous Strapi setup handled migrations internally, but our custom CMS needs an explicit solution.

## Decision

Use **dbmate** for database migrations with the following strategy:

### Tool Choice: dbmate

| Feature | Rationale |
|---------|-----------|
| SQL-based | No ORM magic, explicit schema changes |
| Version-controlled | Migration files in git |
| Language-agnostic | Works with any language/framework |
| No dependencies | Single binary, no runtime overhead |
| PostgreSQL support | Native support for our database |

### Migration Files

```
cms/db/migrations/
├── 20251204164209_initial_schema.sql     # Base schema (marked applied)
└── 20260220102009_media_upload_status.sql # Feature migrations
```

### CI/CD Integration

The deployment workflow runs migrations via SSH tunnel:

```yaml
# 1. Open SSH tunnel to production
ssh -L 15432:localhost:5432 user@host

# 2. Mark initial schema as applied (if not exists)
INSERT INTO schema_migrations (version) VALUES ('20251204164209') ON CONFLICT DO NOTHING

# 3. Run pending migrations
dbmate -d db/migrations --no-dump-schema up

# 4. Restart CMS service
systemctl restart cms
```

### Key Implementation Details

**URL Encoding for Special Characters:**
```bash
# Passwords with special chars need proper encoding
export SAFE_DB_URL="$(echo "$DATABASE_URL" | bun -e "
  const url = new URL(process.stdin.read());
  url.password = encodeURIComponent(url.password);
  url.port = '15432';
  url.searchParams.set('sslmode', 'disable');
  process.stdout.write(url.toString());
")"
```

**Initial Schema Handling:**
Since the database already had tables from manual setup, we mark the initial migration as applied without running it:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(128) PRIMARY KEY);
INSERT INTO schema_migrations (version) VALUES ('20251204164209') ON CONFLICT DO NOTHING;
```

**Ownership Fix:**
After migrations, we ensure the `cms` database user owns all objects:

```sql
DO $$
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO cms';
  END LOOP;
END $$;
```

## Consequences

### Positive

1. **Explicit Migrations** - SQL files show exactly what changes
2. **Version Controlled** - Migrations tracked in git alongside code
3. **Automatic Deployment** - Zero-touch migration on every deploy
4. **Language Agnostic** - Could switch from Bun/TS and keep migrations
5. **Simple Rollback** - `dbmate rollback` for reversions
6. **No Runtime Dependency** - dbmate only used at deploy time

### Negative

1. **Manual SQL Writing** - No auto-generated migrations from model changes
2. **SSH Tunnel Complexity** - Extra step for production DB access
3. **No Built-in Seeding** - Separate from migration system

### Neutral

1. **Separate from Kysely** - Query builder and migrations are different tools
2. **PostgreSQL Specific** - Would need different tool for other databases

## Alternatives Considered

### 1. Kysely Migrations

**Rejected because:**
- Kysely's migration system is more basic
- Still requires manual SQL or query builder syntax
- No significant advantage over dbmate

### 2. Prisma Migrate

**Rejected because:**
- Adds heavy dependency
- Requires schema definition in Prisma format
- Overkill for our simple migration needs

### 3. Flyway

**Rejected because:**
- Java-based, heavier than dbmate
- More complex than needed
- dbmate covers all our requirements

### 4. Manual Migration Scripts

**Rejected because:**
- No version tracking
- Easy to miss running migrations
- Harder to coordinate in team settings

## References

- [dbmate Documentation](https://github.com/amacneil/dbmate)
- [Commit: Run database migrations on deploy](https://github.com/ivokun/ivokun.com/commit/0d135ef)
- [Deploy Workflow](../../.github/workflows/deploy-cms.yml)
- [Migration Files](../../cms/db/migrations/)
