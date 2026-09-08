#!/usr/bin/env bash
# Integration smoke test for the web (Astro) frontend:
#   1. starts a stub CMS API (scripts/stub-cms.ts) with the exact response
#      shapes web/src/api/*.ts expect
#   2. runs `astro build` against it (static generation end-to-end)
#   3. verifies every public page rendered real content and no page embedded
#      CMS error text ("unreachable", "is not set", "Internal Server Error")
#
# Hermetic: no live CMS, no real network. Run from anywhere; paths are
# resolved relative to this script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT="${STUB_CMS_PORT:-4173}"

STUB_PID=""
cleanup() {
  if [ -n "$STUB_PID" ]; then kill "$STUB_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

echo "[web-smoke] starting stub CMS on :$PORT..."
bun "$SCRIPT_DIR/stub-cms.ts" &
STUB_PID=$!

for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then break; fi
  if [ "$i" = 30 ]; then echo "FAIL: stub CMS did not become ready" >&2; exit 1; fi
  sleep 0.5
done
echo "ok: stub CMS ready"

echo "[web-smoke] building with stub CMS..."
cd "$WEB_DIR"
# cmsFetch joins CMS_API_URL with paths like "api/posts" itself,
# so the base URL must NOT carry an /api suffix.
CMS_API_URL="http://127.0.0.1:$PORT" CMS_API_TOKEN=smoke-test-token bun run build

DIST="$WEB_DIR/dist"
[ -d "$DIST" ] || { echo "FAIL: $DIST not found after build" >&2; exit 1; }

# No generated page may embed CMS error text — that's the "silent SSG failure"
# class of bug this smoke test exists to catch (cf. docs/adr/013).
error_pages="$(grep -rliE 'CMS API is unreachable|environment variable is not set|Internal Server Error' "$DIST" --include='*.html' || true)"
if [ -n "$error_pages" ]; then
  echo "FAIL: CMS errors rendered into generated pages:" >&2
  echo "$error_pages" >&2
  exit 1
fi
echo "ok: no CMS error text embedded in any generated page"

for f in index.html about/index.html gallery/index.html 404.html; do
  [ -f "$DIST/$f" ] || { echo "FAIL: missing $DIST/$f" >&2; exit 1; }
  grep -qi '<main' "$DIST/$f" || { echo "FAIL: $f missing <main>" >&2; exit 1; }
  echo "ok: $f"
done

shopt -s globstar nullglob
articles=("$DIST"/articles/**/*.html)
shopt -u globstar nullglob
if [ "${#articles[@]}" -eq 0 ]; then
  echo "FAIL: no article pages generated under $DIST/articles/" >&2
  exit 1
fi
for f in "${articles[@]}"; do
  grep -qi 'Hello World' "$f" || { echo "FAIL: $f missing stub article content" >&2; exit 1; }
done
echo "ok: articles/*.html (${#articles[@]} pages, stub content rendered)"

echo '[web-smoke] PASSED'
