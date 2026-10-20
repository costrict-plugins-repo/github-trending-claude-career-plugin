#!/usr/bin/env bash
set -uo pipefail

echo "=== Career-Ops Plugin Integration Test ==="
echo ""

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_WS=$(mktemp -d)
trap "rm -rf $TEST_WS" EXIT
PASS=0
FAIL=0

pass() { echo "  ✓ $1"; ((PASS++)); }
fail() { echo "  ✗ $1"; ((FAIL++)); }

# ---------------------------------------------------------------------------
# Step 1: Scaffold workspace
# ---------------------------------------------------------------------------
echo "--- Step 1: Scaffold workspace ---"

mkdir -p "$TEST_WS/config" \
         "$TEST_WS/modes" \
         "$TEST_WS/data" \
         "$TEST_WS/reports" \
         "$TEST_WS/output" \
         "$TEST_WS/jds" \
         "$TEST_WS/interview-prep" \
         "$TEST_WS/batch/tracker-additions" \
         "$TEST_WS/batch/logs"

# Create marker file (simulating /career-ops init)
echo '{"version":"1.0.0","pluginRoot":"'"$PLUGIN_DIR"'"}' > "$TEST_WS/.career-ops.json"

# Copy templates
if cp "$PLUGIN_DIR/templates/portals.example.yml" "$TEST_WS/portals.yml" 2>/dev/null; then
  pass "Copy portals.example.yml → portals.yml"
else
  fail "Copy portals.example.yml → portals.yml"
fi

if cp "$PLUGIN_DIR/config/profile.example.yml" "$TEST_WS/config/profile.yml" 2>/dev/null; then
  pass "Copy profile.example.yml → config/profile.yml"
else
  fail "Copy profile.example.yml → config/profile.yml"
fi

if cp "$PLUGIN_DIR/modes/_profile.template.md" "$TEST_WS/modes/_profile.md" 2>/dev/null; then
  pass "Copy _profile.template.md → modes/_profile.md"
else
  fail "Copy _profile.template.md → modes/_profile.md"
fi

# Create cv.md
printf "# Test CV\n\nTest content\n" > "$TEST_WS/cv.md"
if [ -f "$TEST_WS/cv.md" ]; then
  pass "Create cv.md"
else
  fail "Create cv.md"
fi

# Create applications.md with tracker header
cat > "$TEST_WS/data/applications.md" << 'TRACKER'
# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 1 | 2026-04-01 | Acme Corp | AI Engineer | 4.2/5 | Evaluated | ❌ | [1](reports/001-acme-2026-04-01.md) | Test entry |
TRACKER
if [ -f "$TEST_WS/data/applications.md" ]; then
  pass "Create data/applications.md"
else
  fail "Create data/applications.md"
fi

# Create pipeline.md
printf "# Pipeline\n" > "$TEST_WS/data/pipeline.md"
if [ -f "$TEST_WS/data/pipeline.md" ]; then
  pass "Create data/pipeline.md"
else
  fail "Create data/pipeline.md"
fi

# Create a matching report file so verify-pipeline doesn't flag a broken link
mkdir -p "$TEST_WS/reports"
printf "# Report 001\n\n**URL:** https://example.com/job\n" > "$TEST_WS/reports/001-acme-2026-04-01.md"
if [ -f "$TEST_WS/reports/001-acme-2026-04-01.md" ]; then
  pass "Create matching report file"
else
  fail "Create matching report file"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 2: Test resolve-paths
# ---------------------------------------------------------------------------
echo "--- Step 2: Test resolve-paths ---"

if node "$PLUGIN_DIR/scripts/resolve-paths.test.mjs" >/dev/null 2>&1; then
  pass "resolve-paths.test.mjs"
else
  fail "resolve-paths.test.mjs"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 3: Test doctor
# ---------------------------------------------------------------------------
echo "--- Step 3: Test doctor ---"

# Doctor will fail on some checks (fonts, playwright) but should not crash
DOCTOR_OUTPUT=$(node "$PLUGIN_DIR/scripts/doctor.mjs" --workspace "$TEST_WS" 2>&1) || true
if echo "$DOCTOR_OUTPUT" | grep -q "career-ops doctor"; then
  pass "doctor.mjs runs without crashing"
else
  fail "doctor.mjs runs without crashing"
fi

# Check that doctor found cv.md
if echo "$DOCTOR_OUTPUT" | grep -q "cv.md found"; then
  pass "doctor.mjs detects cv.md"
else
  fail "doctor.mjs detects cv.md"
fi

# Check that doctor found profile
if echo "$DOCTOR_OUTPUT" | grep -q "profile.yml found"; then
  pass "doctor.mjs detects config/profile.yml"
else
  fail "doctor.mjs detects config/profile.yml"
fi

# Check that doctor found portals
if echo "$DOCTOR_OUTPUT" | grep -q "portals.yml found"; then
  pass "doctor.mjs detects portals.yml"
else
  fail "doctor.mjs detects portals.yml"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 4: Test verify-pipeline
# ---------------------------------------------------------------------------
echo "--- Step 4: Test verify-pipeline ---"

VERIFY_OUTPUT=$(node "$PLUGIN_DIR/scripts/verify-pipeline.mjs" --workspace "$TEST_WS" 2>&1) || true
if echo "$VERIFY_OUTPUT" | grep -q "Checking"; then
  pass "verify-pipeline.mjs runs and finds entries"
else
  fail "verify-pipeline.mjs runs and finds entries"
fi

# Pipeline should report no broken links (we created the matching report)
if echo "$VERIFY_OUTPUT" | grep -q "All report links valid"; then
  pass "verify-pipeline.mjs: report links valid"
else
  fail "verify-pipeline.mjs: report links valid"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 5: Test merge-tracker (dry-run)
# ---------------------------------------------------------------------------
echo "--- Step 5: Test merge-tracker ---"

# Create a test TSV in tracker-additions
printf "2\t2026-04-02\tNewCo\tData Scientist\tEvaluated\t3.8/5\t❌\t[2](reports/002-newco-2026-04-02.md)\tTest merge" \
  > "$TEST_WS/batch/tracker-additions/002-newco.tsv"

MERGE_OUTPUT=$(node "$PLUGIN_DIR/scripts/merge-tracker.mjs" --dry-run --workspace "$TEST_WS" 2>&1) || true
if echo "$MERGE_OUTPUT" | grep -q "pending additions"; then
  pass "merge-tracker.mjs detects pending TSV"
else
  fail "merge-tracker.mjs detects pending TSV"
fi

if echo "$MERGE_OUTPUT" | grep -q "dry-run"; then
  pass "merge-tracker.mjs respects --dry-run"
else
  fail "merge-tracker.mjs respects --dry-run"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 6: Test dedup-tracker (dry-run)
# ---------------------------------------------------------------------------
echo "--- Step 6: Test dedup-tracker ---"

DEDUP_OUTPUT=$(node "$PLUGIN_DIR/scripts/dedup-tracker.mjs" --dry-run --workspace "$TEST_WS" 2>&1) || true
if echo "$DEDUP_OUTPUT" | grep -q "entries loaded"; then
  pass "dedup-tracker.mjs runs without crashing"
else
  fail "dedup-tracker.mjs runs without crashing"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 7: Test normalize-statuses (dry-run)
# ---------------------------------------------------------------------------
echo "--- Step 7: Test normalize-statuses ---"

NORMALIZE_OUTPUT=$(node "$PLUGIN_DIR/scripts/normalize-statuses.mjs" --dry-run --workspace "$TEST_WS" 2>&1) || true
if echo "$NORMALIZE_OUTPUT" | grep -q "statuses normalized\|No changes needed"; then
  pass "normalize-statuses.mjs runs without crashing"
else
  fail "normalize-statuses.mjs runs without crashing"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 8: Check plugin manifest
# ---------------------------------------------------------------------------
echo "--- Step 8: Check plugin manifest ---"

if [ -f "$PLUGIN_DIR/.claude-plugin/plugin.json" ]; then
  pass "plugin.json exists"
else
  fail "plugin.json exists"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 9: Check command file
# ---------------------------------------------------------------------------
echo "--- Step 9: Check command file ---"

if [ -f "$PLUGIN_DIR/commands/career-ops.md" ]; then
  pass "commands/career-ops.md exists"
else
  fail "commands/career-ops.md exists"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 10: Check init skill
# ---------------------------------------------------------------------------
echo "--- Step 10: Check init skill ---"

if [ -f "$PLUGIN_DIR/skills/career-ops-init/SKILL.md" ]; then
  pass "skills/career-ops-init/SKILL.md exists"
else
  fail "skills/career-ops-init/SKILL.md exists"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 11: Check hooks
# ---------------------------------------------------------------------------
echo "--- Step 11: Check hooks ---"

if [ -f "$PLUGIN_DIR/hooks/hooks.json" ]; then
  pass "hooks/hooks.json exists"
else
  fail "hooks/hooks.json exists"
fi

if [ -f "$PLUGIN_DIR/hooks/session-start.mjs" ]; then
  pass "hooks/session-start.mjs exists"
else
  fail "hooks/session-start.mjs exists"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 12: Test session-start hook
# ---------------------------------------------------------------------------
echo "--- Step 12: Test session-start hook ---"

# Run session-start from the test workspace so it finds .career-ops.json
HOOK_OUTPUT=$(cd "$TEST_WS" && CLAUDE_PLUGIN_ROOT="$PLUGIN_DIR" node "$PLUGIN_DIR/hooks/session-start.mjs" 2>&1) || true
if echo "$HOOK_OUTPUT" | grep -q '"status":"ready"'; then
  pass "session-start.mjs outputs ready status"
else
  fail "session-start.mjs outputs ready status"
fi

if echo "$HOOK_OUTPUT" | grep -q '"workspace"'; then
  pass "session-start.mjs includes workspace path"
else
  fail "session-start.mjs includes workspace path"
fi

echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
