# CMS Cutover Plan

Migration from Strapi 5 to ivokun CMS.

## Pre-Migration Checklist

### Infrastructure

- [ ] PostgreSQL database provisioned
- [ ] R2 bucket created with public access configured
- [ ] DNS records prepared (if changing domains)
- [ ] NixOS host configured with `services.ivokun-cms` module
- [ ] Secrets file created with all required environment variables
- [ ] Backup strategy in place for new database

### Strapi Preparation

- [ ] Strapi instance running and accessible
- [ ] API token generated with read access to all content types
- [ ] Note total counts: categories, posts, galleries, media files
- [ ] Identify any content currently in draft state (may need manual review)

### New CMS Preparation

- [ ] Binary built (`bun run build`)
- [ ] Database migrations applied (`bun run db:up`)
- [ ] Admin user created (`bun run seed:admin`)
- [ ] Test login to admin panel works
- [ ] API key generated for frontend

## Migration Steps

### Phase 1: Data Migration (Production Strapi -> New CMS)

```bash
# 1. Run dry-run first to verify
STRAPI_URL=https://strapi.ivokun.com \
STRAPI_TOKEN=your-token \
DATABASE_URL=postgres://... \
bun run migrate:strapi --dry-run

# 2. If dry-run looks good, run full migration
STRAPI_URL=https://strapi.ivokun.com \
STRAPI_TOKEN=your-token \
DATABASE_URL=postgres://... \
R2_ACCESS_KEY_ID=... \
R2_ACCESS_SECRET=... \
R2_ENDPOINT=... \
R2_BUCKET=... \
R2_PUBLIC_URL=... \
bun run migrate:strapi
```

### Phase 2: Verification

Run these queries against the new database:

```sql
-- Count verification
SELECT 'categories' as type, count(*) FROM categories
UNION ALL
SELECT 'posts', count(*) FROM posts
UNION ALL
SELECT 'galleries', count(*) FROM galleries
UNION ALL
SELECT 'media', count(*) FROM media;

-- Check for posts without content
SELECT id, title, slug FROM posts WHERE content IS NULL;

-- Check for media without URLs
SELECT id, filename FROM media WHERE urls IS NULL;

-- Verify published posts
SELECT count(*) FROM posts WHERE status = 'published';
```

### Phase 3: Frontend Update

1. Update frontend environment variables:
   ```
   CMS_API_URL=https://cms.ivokun.com/api
   CMS_API_TOKEN=new-api-key-from-admin
   ```

2. Update API client code if response format differs

3. Test all pages locally:
   - [ ] Homepage loads with hero and description
   - [ ] Articles list shows all posts
   - [ ] Individual article pages render correctly
   - [ ] Gallery list and detail pages work
   - [ ] Images load from R2 URLs

### Phase 4: DNS Cutover

1. Deploy new CMS to production
2. Verify health endpoint: `curl https://cms.ivokun.com/health`
3. Update DNS if needed
4. Deploy updated frontend
5. Monitor for errors

## Validation Checklist

### Content Integrity

- [ ] All categories migrated (compare counts)
- [ ] All posts migrated with correct status (draft/published)
- [ ] Post content renders correctly (check TipTap conversion)
- [ ] Featured images display correctly
- [ ] All galleries migrated with images
- [ ] Home page content displays correctly

### Media Files

- [ ] All images accessible via R2 URLs
- [ ] Image variants generated (thumbnail, small, large, original)
- [ ] Alt text preserved
- [ ] No broken image links on frontend

### API Functionality

- [ ] Public API returns posts with correct structure
- [ ] Pagination works correctly
- [ ] Filtering by category works
- [ ] Locale filtering works (en/id)
- [ ] Admin API CRUD operations work

### Admin Panel

- [ ] Login/logout works
- [ ] Can view and edit posts
- [ ] Can upload new media
- [ ] Can create new content
- [ ] Rich text editor functions correctly

## Rollback Procedure

If critical issues are found after cutover:

### Immediate Rollback (< 1 hour post-cutover)

1. Revert frontend environment variables to Strapi
2. Redeploy frontend
3. No data loss as Strapi was not modified

### Extended Rollback (> 1 hour, new content created)

1. Export new content from CMS database:
   ```sql
   COPY (SELECT * FROM posts WHERE created_at > 'CUTOVER_TIMESTAMP') TO '/tmp/new_posts.csv' CSV HEADER;
   ```

2. Revert frontend to Strapi

3. Manually recreate new content in Strapi (if any)

## Post-Migration Tasks

- [ ] Monitor error logs for 24 hours
- [ ] Verify search engine indexing (if applicable)
- [ ] Update any external integrations
- [ ] Archive Strapi database backup
- [ ] Document any issues encountered
- [ ] Schedule Strapi instance decommission (after 1 week stability)

## Contacts

- **CMS Issues**: [your contact]
- **Infrastructure**: [your contact]
- **Frontend**: [your contact]

## Timeline

| Step | Duration | Owner |
|------|----------|-------|
| Pre-migration checks | 30 min | |
| Data migration | 15 min | |
| Verification | 30 min | |
| Frontend update | 15 min | |
| DNS cutover | 5 min | |
| Monitoring | 24 hours | |

**Estimated total cutover window: 1.5 hours**
