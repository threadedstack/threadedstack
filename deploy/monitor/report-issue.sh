#!/usr/bin/env bash
# Human-visibility layer for the system monitor. Opens / updates / resolves a
# single de-duplicated GitHub issue so a human sees health state at a glance.
# The ACTUAL fix path is the task proposals filed by system-monitor.sh; this is
# just a status beacon. Uses the built-in GH_TOKEN (needs issues: write).
#
# Usage: report-issue.sh --alert | --resolve
set -uo pipefail

REPO="${MONITOR_REPO:-threadedstack/threadedstack}"
LABEL="system-health"
TITLE="🔴 Autonomous system health alert"
REPORT="${HUMAN_REPORT:-/tmp/monitor-report.txt}"
MODE="${1:---alert}"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Ensure the label exists (idempotent).
gh label create "$LABEL" --repo "$REPO" --color B60205 \
  --description "External monitor health alerts" >/dev/null 2>&1 || true

# Find the open alert issue, if any.
ISSUE="$(gh issue list --repo "$REPO" --state open --label "$LABEL" \
  --json number --jq '.[0].number' 2>/dev/null)"

case "$MODE" in
  --alert)
    VIOLATIONS="$(cat "$REPORT" 2>/dev/null)"
    [ -z "$VIOLATIONS" ] && VIOLATIONS="- (violation detail unavailable)"
    BODY="$(printf 'External monitor detected invariant violation(s) at %s.\n\nA task proposal has been filed for each (source signal `health`); the work cycle will pick them up and open fix PRs. This issue is a human status beacon and will auto-close when the monitor next reports healthy.\n\n**Current violations:**\n%s\n\n_Run: %s_' \
      "$TS" "$VIOLATIONS" "${GITHUB_RUN_URL:-manual}")"
    if [ -n "$ISSUE" ]; then
      gh issue comment "$ISSUE" --repo "$REPO" --body "$BODY"
      echo "updated issue #$ISSUE"
    else
      gh issue create --repo "$REPO" --title "$TITLE" --label "$LABEL" --body "$BODY"
      echo "opened new health issue"
    fi
    ;;
  --resolve)
    if [ -n "$ISSUE" ]; then
      gh issue comment "$ISSUE" --repo "$REPO" \
        --body "✅ Monitor reports all invariants healthy at $TS. Auto-closing."
      gh issue close "$ISSUE" --repo "$REPO" --reason completed
      echo "resolved issue #$ISSUE"
    else
      echo "healthy, no open issue"
    fi
    ;;
  *) echo "usage: report-issue.sh --alert|--resolve" >&2; exit 2 ;;
esac
