#!/usr/bin/env bash
# .uat/run.sh — Run one or all UAT validation plans
#
# Usage:
#   .uat/run.sh                          # run all plans in order
#   .uat/run.sh 01-server-boot           # run a specific plan
#   .uat/run.sh 08-wiki-crud 09-fragment # run multiple plans
#
# Each plan .md has a ```bash block that is extracted and executed.
# Output logs to .uat/logs/<plan>-<timestamp>.log

set -euo pipefail
UAT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLANS_DIR="$UAT_DIR/plans"
LOGS_DIR="$UAT_DIR/logs"
RUNS_DIR="$UAT_DIR/runs"
mkdir -p "$LOGS_DIR" "$RUNS_DIR"

RUN_ID="$(date +%Y%m%dT%H%M%S)"
TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0
RESULTS=()

run_plan() {
  local md="$1"
  local name
  name="$(basename "$md" .md)"
  local log="$LOGS_DIR/${name}-${RUN_ID}.log"
  local script
  script="$(sed -n '/^```bash$/,/^```$/{ /^```/d; p; }' "$md")"

  if [ -z "$script" ]; then
    echo "  ⊘ $name — no bash block found"
    TOTAL_SKIP=$((TOTAL_SKIP + 1))
    RESULTS+=("SKIP $name")
    return
  fi

  echo "▸ $name"

  # Export UAT env for the script
  export UAT_LOG="$log"
  export UAT_DIR
  export UAT_RUN_ID="$RUN_ID"
  export PROJECT_ROOT="$(cd "$UAT_DIR/.." && pwd)"

  # Run in subshell, capture exit code
  set +e
  bash -c "$script" > "$log" 2>&1
  local exit_code=$?
  set -e

  # Parse pass/fail from the summary line in the log.
  # Some plans wrap the summary in decorative dividers, so the counts may not
  # be on the very last line. Search the last 10 lines for the pattern.
  local summary_block
  summary_block="$(tail -10 "$log")"
  local plan_pass plan_fail
  plan_pass="$(echo "$summary_block" | grep -oP '\d+(?= passed)' | tail -1)"
  plan_pass="${plan_pass:-0}"
  plan_fail="$(echo "$summary_block" | grep -oP '\d+(?= failed)' | tail -1)"
  plan_fail="${plan_fail:-0}"

  TOTAL_PASS=$((TOTAL_PASS + plan_pass))
  TOTAL_FAIL=$((TOTAL_FAIL + plan_fail))

  if [ "$exit_code" -eq 0 ] && [ "$plan_fail" -eq 0 ]; then
    echo "  ✓ $name — $plan_pass passed"
    RESULTS+=("PASS $name ($plan_pass passed)")
  else
    echo "  ✗ $name — $plan_pass passed, $plan_fail failed"
    RESULTS+=("FAIL $name ($plan_pass passed, $plan_fail failed)")
    echo "    log: $log"
  fi
}

# Determine which plans to run
if [ $# -gt 0 ]; then
  PLAN_FILES=()
  for arg in "$@"; do
    found="$PLANS_DIR/${arg}.md"
    [ -f "$found" ] || found="$(ls "$PLANS_DIR"/${arg}*.md 2>/dev/null | head -1)"
    if [ -f "$found" ]; then
      PLAN_FILES+=("$found")
    else
      echo "  ✗ plan not found: $arg"
    fi
  done
else
  PLAN_FILES=("$PLANS_DIR"/*.md)
fi

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Robin UAT — $RUN_ID"
echo "  Plans: ${#PLAN_FILES[@]}"
echo "══════════════════════════════════════════════════════════"
echo ""

for plan in "${PLAN_FILES[@]}"; do
  run_plan "$plan"
done

# Write run summary
SUMMARY="$RUNS_DIR/${RUN_ID}.txt"
{
  echo "Robin UAT Run: $RUN_ID"
  echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  for r in "${RESULTS[@]}"; do echo "  $r"; done
  echo ""
  echo "Total: $TOTAL_PASS passed, $TOTAL_FAIL failed, $TOTAL_SKIP skipped"
} > "$SUMMARY"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  $TOTAL_PASS passed, $TOTAL_FAIL failed, $TOTAL_SKIP skipped"
echo "  Summary: $SUMMARY"
echo "══════════════════════════════════════════════════════════"

[ "$TOTAL_FAIL" -eq 0 ] && exit 0 || exit 1
