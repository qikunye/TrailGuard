#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# TrailGuard — Kong Gateway Route Smoke Tests
#
# Usage:
#   chmod +x kong/test_routes.sh
#   ./kong/test_routes.sh
#
# Prerequisites:
#   - Docker Compose stack is running  (docker compose up -d)
#   - All backend services are healthy
#   - DEV_KEY matches the key in kong/kong.yml for the 'dev-testing' consumer
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

KONG_PROXY="http://localhost:8080"
DEV_KEY="tg-dev-key-local-only"

# Colours
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

pass() { echo -e "${GREEN}  ✓ PASS${NC}  $1"; ((PASS++)); }
fail() { echo -e "${RED}  ✗ FAIL${NC}  $1 — $2"; ((FAIL++)); }
info() { echo -e "${YELLOW}  →${NC}  $1"; }

check() {
  local label="$1"
  local expected_status="$2"
  local url="$3"
  local method="${4:-GET}"
  local extra_args=("${@:5}")    # any additional curl args

  actual_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X "$method" \
    -H "X-API-Key: $DEV_KEY" \
    "${extra_args[@]}" \
    "$url" 2>/dev/null)

  if [[ "$actual_status" == "$expected_status" ]]; then
    pass "$label (HTTP $actual_status)"
  else
    fail "$label" "expected HTTP $expected_status, got HTTP $actual_status"
  fi
}

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  TrailGuard — Kong API Gateway Smoke Tests"
echo "  Target: $KONG_PROXY"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── 1. Authentication enforcement ───────────────────────────────────────────
info "Testing authentication enforcement..."

no_key_status=$(curl -s -o /dev/null -w "%{http_code}" "$KONG_PROXY/api/orchestrator/health")
if [[ "$no_key_status" == "401" ]]; then
  pass "No API key → 401 Unauthorized"
  ((PASS++))
else
  fail "No API key enforcement" "expected 401, got $no_key_status"
fi

wrong_key_status=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: wrong-key" "$KONG_PROXY/api/orchestrator/health")
if [[ "$wrong_key_status" == "401" ]]; then
  pass "Wrong API key → 401 Unauthorized"
  ((PASS++))
else
  fail "Wrong key enforcement" "expected 401, got $wrong_key_status"
fi

echo ""

# ─── 2. Health endpoints (all services) ──────────────────────────────────────
info "Testing /health endpoints on all services..."

check "Orchestrator health"             200  "$KONG_PROXY/api/orchestrator/health"
check "Incident Reporting health"       200  "$KONG_PROXY/api/incident/health"
check "Hiker Profile health"            200  "$KONG_PROXY/api/hiker/health"
check "Trail Condition health"          200  "$KONG_PROXY/api/trail/health"
check "Incident Risk health"            200  "$KONG_PROXY/api/risk/health"
check "Hike Completion health"          200  "$KONG_PROXY/api/completion/health"
check "Weather Wrapper health"          200  "$KONG_PROXY/api/weather/health"
check "Evaluator Wrapper health"        200  "$KONG_PROXY/api/evaluator/health"
check "Google Maps Wrapper health"      200  "$KONG_PROXY/api/maps/health"
check "Notification Wrapper health"     200  "$KONG_PROXY/api/notify/health"
check "Emergency Contacts health"       200  "$KONG_PROXY/api/emergency/health"
check "Incident Service health"         200  "$KONG_PROXY/api/incidents-svc/health"
check "Nearby Users health"             200  "$KONG_PROXY/api/nearby/health"
check "Completed User Hike health"      200  "$KONG_PROXY/api/completed/health"

echo ""

# ─── 3. Key functional routes ─────────────────────────────────────────────────
info "Testing key functional routes (non-destructive GETs)..."

check "Get all trails"                  200  "$KONG_PROXY/api/orchestrator/trails"
check "Trail condition (trail 1)"       200  "$KONG_PROXY/api/trail/Condition/1"
check "Hiker capability (user 1)"       200  "$KONG_PROXY/api/hiker/Capability/1"
check "Incident risk (trail 1, 30d)"    200  "$KONG_PROXY/api/risk/GetRecentIncidents/1/30"
check "Nearby users (trail 1)"          200  "$KONG_PROXY/api/nearby/getNearby/1"
check "Emergency contacts (user 1)"     200  "$KONG_PROXY/api/emergency/GetEmergency/1"

echo ""

# ─── 4. Route strip verification ─────────────────────────────────────────────
info "Verifying strip_path (path prefix is removed before forwarding)..."

# /api/maps/reverse-geocode should forward as /reverse-geocode
maps_status=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: $DEV_KEY" \
  "$KONG_PROXY/api/maps/reverse-geocode?lat=1.3521&lng=103.8198")
# 200 or 422 (missing fields) both mean Kong forwarded successfully
if [[ "$maps_status" =~ ^(200|422|400)$ ]]; then
  pass "Maps strip_path (HTTP $maps_status — upstream reached)"
  ((PASS++))
else
  fail "Maps strip_path" "expected 200/400/422, got $maps_status"
fi

echo ""

# ─── 5. Rate limit headers ────────────────────────────────────────────────────
info "Checking rate-limit response headers..."

rl_headers=$(curl -s -I \
  -H "X-API-Key: $DEV_KEY" \
  "$KONG_PROXY/api/orchestrator/health" 2>/dev/null)

if echo "$rl_headers" | grep -qi "x-ratelimit"; then
  pass "Rate-limit headers present in response"
  ((PASS++))
else
  fail "Rate-limit headers" "X-RateLimit-* headers not found in response"
fi

echo ""

# ─── 6. Kong Admin API reachable ─────────────────────────────────────────────
info "Checking Kong Admin API (internal use only)..."

admin_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8001/")
if [[ "$admin_status" == "200" ]]; then
  pass "Kong Admin API reachable at :8001"
  ((PASS++))
else
  fail "Kong Admin API" "expected 200, got $admin_status"
fi

echo ""

# ─── Summary ──────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
echo "═══════════════════════════════════════════════════════"
echo -e "  Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / $TOTAL total"
echo "═══════════════════════════════════════════════════════"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo -e "${YELLOW}Tip:${NC} If health endpoints return 404, the backend service"
  echo "  may not expose a /health route — that's fine, the route is still proxied."
  echo "  Check actual service logs: docker compose logs <service-name>"
  echo ""
  exit 1
fi

exit 0
