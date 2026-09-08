#!/usr/bin/env bash
# Regression guards for incidents found during the 2026-08 hardening round.
#
# 1) CI workflows must not install tools from floating flake refs.
#    Incident 2026-09-08: `nix profile install github:cachix/devenv/latest`
#    silently picked up devenv 2.3 (released that week) which broke nix
#    evaluation ("The option `dotenv.resolved' was accessed but has no value
#    defined") and redened every workflow before any project code ran.
#
# 2) Docs must not drift from shipped reality.
#    Incident 2026-08: AGENTS.md + cms/README.md described the admin SPA as
#    SolidJS while the shipped code is React; cms/CUTOVER.md shipped a
#    CMS_API_URL example with an /api suffix, which cmsFetch turns into
#    /api/api/... 404s (cmsFetch appends "api/..." paths itself).
#
# Usage: bash scripts/check-ci-hygiene.sh [repo-root]
# Exits non-zero if any guard trips.

set -euo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"
fail=0

echo "[hygiene] checking CI workflows for floating flake refs..."
FLOATING_RE='github:[^[:space:]]+/(latest|main|master|rolling)([^a-zA-Z0-9_-]|$)'
for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  [ -f "$f" ] || continue
  matches="$(grep -nE "$FLOATING_RE" "$f" || true)"
  if [ -n "$matches" ]; then
    echo "FAIL: $f installs from a floating flake ref (pin to a tag or full SHA):" >&2
    echo "$matches" >&2
    fail=1
  fi
done

echo "[hygiene] checking cms/CUTOVER.md CMS_API_URL example..."
matches="$(grep -nE 'CMS_API_URL=[^[:space:]]*://[^[:space:]]*/api([^a-zA-Z0-9_-]|$)' cms/CUTOVER.md || true)"
if [ -n "$matches" ]; then
  echo "FAIL: cms/CUTOVER.md CMS_API_URL example ends with /api" >&2
  echo "(cmsFetch appends api/ paths itself -> requests hit /api/api/...):" >&2
  echo "$matches" >&2
  fail=1
fi

echo "[hygiene] checking AGENTS.md / cms READMEs for SolidJS claims..."
matches="$(grep -inE 'solid' AGENTS.md cms/README.md || true)"
if [ -n "$matches" ]; then
  echo "FAIL: AGENTS.md / cms/README.md mention SolidJS" >&2
  echo "(admin SPA is React; historical notes belong in docs/adr/003 only):" >&2
  echo "$matches" >&2
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "[hygiene] FAILED" >&2
  exit 1
fi
echo "[hygiene] OK"
