# CMS Code Review Issues

**Review Date:** 2026-03-02  
**CMS Package:** `@ivokundotcom/cms`  
**Review Methodology:** Multi-subagent code review across all functional areas

---

## Executive Summary

This document consolidates **148+ issues** identified across the CMS codebase during a comprehensive code review. Issues are categorized by severity and functional area.

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 **Critical** | 28 | Security vulnerabilities, data integrity issues, race conditions |
| 🟠 **High** | 42 | Test coverage gaps, missing validation, API inconsistencies |
| 🟡 **Medium** | 48 | UX improvements, code quality, missing features |
| 🟢 **Low** | 30 | Minor optimizations, cleanup, polish |

---

## Issue Categories

| Category | File | Issue Count |
|----------|------|-------------|
| Security | [01-security.md](./01-security.md) | 22 |
| Data Integrity | [02-data-integrity.md](./02-data-integrity.md) | 18 |
| API & Types | [03-api-types.md](./03-api-types.md) | 24 |
| Testing | [04-testing.md](./04-testing.md) | 16 |
| UI/UX & Accessibility | [05-ui-ux.md](./05-ui-ux.md) | 32 |
| Architecture | [06-architecture.md](./06-architecture.md) | 20 |

---

## Priority Action Items

### Immediate (Before Next Release)

1. **Add rate limiting to all endpoints** - Currently only login is protected (SEC-003)
2. **Add CSRF protection** - No CSRF tokens for state-changing operations (SEC-007)
3. **Implement request body size limits** - No limit on request body size (SEC-004)
4. **Add storage quotas** - Any authenticated user can upload unlimited files (SEC-010)
5. **Implement session rotation on login** - Existing sessions not invalidated on new login (SEC-012)
6. **Add keywords field implementation** - Schema accepts keywords but DB table has no column (API-008)

### This Sprint

1. Implement password change functionality (SEC-014, UX-012)
2. Add input sanitization on email (SEC-015)
3. Fix transaction support for multi-query operations (DATA-009)
4. Add test coverage for remaining services (TEST-007, TEST-008, TEST-009)
5. Add rich text editor keyboard accessibility (UX-003)
6. Implement proper CORS enforcement in production (SEC-001 remaining work)

### Next Sprint

1. Add bulk operations support (UX-019)
2. Implement soft delete for posts (DATA-014)
3. Add drag-and-drop support for media uploads (UX-020)
4. Implement scheduled publishing (ARCH-014)
5. Add retry mechanism for failed media processing (ARCH-016)

---

## Functional Area Breakdown

### Authentication & Authorization (14 issues)
- Missing unit tests for core security logic
- API key prefix length inconsistency
- No session rotation on login
- Missing CSRF protection
- Self-deletion protection missing
- No password change functionality
- Rate limiting bypass via distributed attacks

### Posts (25 issues)
- Race condition in slug conflict check
- Missing keywords field implementation
- No foreign key validation
- Insufficient test coverage
- Pagination meta mismatch
- published_at not auto-set on publish
- Missing scheduled publishing

### Categories (15 issues)
- Database unique constraint error handling missing
- API response structure mismatch (camelCase vs snake_case)
- Missing description field in frontend
- Poor test coverage
- Type safety violations
- No hierarchical support

### Galleries (20 issues)
- Type mismatch between schema and service
- Unpublish loses published date
- Missing media validation (orphaned references)
- Race condition in slug generation
- No transaction wrapping
- Missing bulk operations

### Media & Storage (20 issues)
- MIME type validation bypass
- No file content validation (magic numbers)
- Race condition in confirmUpload
- Infinite worker loop without backoff
- No image dimension limits (DoS vector)
- No storage quotas
- Orphaned upload cleanup missing

### Database & Home (18 issues)
- Transaction implementation breaks Effect semantics
- Pool cleanup may fail silently
- Missing pool error handlers
- Hardcoded pool configuration
- Missing `short_description` and `title` fields in UI
- Keywords field type mismatch

### Admin UI (20 issues)
- No error boundaries
- Collapsed sidebar missing ARIA
- Rich text editor keyboard accessibility
- Multiple `any` type assertions
- Settings form submission logic error
- Missing loading states
- No confirmation for unpublish

### Server & API (16 issues)
- CORS misconfiguration
- Missing CSP headers
- No request body size limits
- CORS not actually applied
- Unsafe type assertions
- Error logging exposes internal details
- No request ID for tracing

---

## Session Progress

**Date:** 2026-03-02

**Fixed:** 52 issues

**Remaining:** ~25 open, ~4 partial

**Commits:**
- `e4b4794` — SEC-001(partial), SEC-002, SEC-008, SEC-009, SEC-016/API-001, SEC-017
- `04fbab2` — DATA-001, DATA-002, DATA-003, DATA-010
- `2ce6fdf` — DATA-004, DATA-007, DATA-008, ARCH-001, ARCH-002, ARCH-007, ARCH-009
- `6a431c1` — UX-001, UX-004
- `af660be` — UX-009, UX-025
- `6ba4179` — API-003
- `6919924` — API-002, API-004, API-005, API-006, API-007, API-009, API-013, API-014, DATA-005, DATA-006, SEC-013
- `90c9dc3` — SEC-005, SEC-006, SEC-011, DATA-013, TEST-001, TEST-002
- `3d5992d` — TEST-003, TEST-004, TEST-005, TEST-006, TEST-012, UX-002(partial), UX-005, UX-006, UX-008, UX-016, ARCH-008, ARCH-011, ARCH-018, ARCH-019

---

## How to Use This Documentation

1. **Start with Critical issues** - These represent security risks or data corruption potential
2. **Review by functional area** - Focus on areas you're currently working on
3. **Check the detailed files** - Each category file has full issue descriptions and recommended fixes
4. **Create tracking issues** - Consider creating GitHub issues for each item
5. **Prioritize by impact** - Critical/High issues should be addressed before Medium/Low

---

## Contributing to Fixes

When fixing issues:
1. Reference this document in your PR
2. Update the status in the relevant category file
3. Add tests for any new validation or error handling
4. Run the full test suite: `bun --filter '@ivokundotcom/cms' test`
5. Run type check: `bun run typecheck`
