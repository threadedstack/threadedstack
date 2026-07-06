#!/usr/bin/env bash
# External health monitor for the ThreadedStack autonomous agent system.
#
# Observes the loop from OUTSIDE the sandbox pods, and when it detects an
# invariant violation it FILES A TASK PROPOSAL via the prod API so the same
# self-healing backlog (scan -> work cycle -> fix PR -> adversary review ->
# merge) repairs the issue. It NEVER triggers schedules, merges PRs, or mutates
# anything else — the fix always flows through the system, not a manual hand.
#
# Layers:
#   1. GitHub-signal checks (always): adversary-review stall, stuck PR, work-
#      cycle merge-liveness. Needs GH_TOKEN (the built-in Actions token).
#   2. Prod-API schedule-liveness (when TDSK_MONITOR_KEY is set): every enabled
#      schedule must have run within 2.5x its cron cadence.
#
# Proposal filing needs a scoped key with taskProposal:create + taskProposal:read
# (TDSK_MONITOR_KEY). Without the key it still reports + exits non-zero (the
# workflow then opens a GitHub health issue), but cannot self-heal.
#
# Env:
#   GH_TOKEN          required — repo read (Actions token)
#   TDSK_MONITOR_KEY  optional — scoped key: schedule:read, taskProposal:read/create
#   MONITOR_AGENT_ID  proposal author agent (default ag_lvUbjp_, the steward)
#   MONITOR_DRY_RUN   when set, log POST bodies instead of sending (safe testing)
#   MONITOR_REPO / TDSK_API_BASE / TDSK_ORG / TDSK_PROJECT — targets
#   ADVERSARY_STALL_MIN / PR_STUCK_HOURS / MERGE_SILENCE_HOURS — thresholds
set -uo pipefail

REPO="${MONITOR_REPO:-threadedstack/threadedstack}"
STEWARD="${MONITOR_STEWARD:-threadedstack-steward}"
API_BASE="${TDSK_API_BASE:-https://px.threadedstack.app}"
ORG="${TDSK_ORG:-og_0000001}"
PROJ="${TDSK_PROJECT:-pj_tIly2F1}"
AGENT="${MONITOR_AGENT_ID:-ag_lvUbjp_}"
NOW="$(date -u +%s)"

ADVERSARY_STALL_MIN="${ADVERSARY_STALL_MIN:-40}"
PR_STUCK_HOURS="${PR_STUCK_HOURS:-6}"
MERGE_SILENCE_HOURS="${MERGE_SILENCE_HOURS:-5}"

VIOL_JSONL="${VIOL_JSONL:-/tmp/monitor-viol.jsonl}"
HUMAN_REPORT="${HUMAN_REPORT:-/tmp/monitor-report.txt}"
: > "$VIOL_JSONL"; : > "$HUMAN_REPORT"

echo "=== SYSTEM MONITOR $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "repo=$REPO prodCheck=$([ -n "${TDSK_MONITOR_KEY:-}" ] && echo on || echo off) dryRun=${MONITOR_DRY_RUN:-0}"

# ---------------------------------------------------------------------------
# Layer 1 — GitHub signals
# ---------------------------------------------------------------------------
PRS_JSON="$(gh pr list --repo "$REPO" --state open \
  --json number,author,createdAt,updatedAt,reviewDecision,mergeStateStatus,statusCheckRollup 2>/dev/null)"
[ -z "$PRS_JSON" ] && PRS_JSON='[]'

echo "--- open PRs ---"
echo "$PRS_JSON" | jq -r --argjson now "$NOW" '
  def checks($p): ($p.statusCheckRollup // [] | map(select(.__typename=="CheckRun")));
  if length==0 then "  (none open)" else .[] | . as $p | (checks($p)) as $c
  | (if ($c|length)==0 then "none"
     elif ($c|any(.conclusion|IN("FAILURE","CANCELLED","TIMED_OUT","STARTUP_FAILURE"))) then "red"
     elif ($c|all(.conclusion=="SUCCESS")) then "green" else "pending" end) as $ci
  | "  #\($p.number) \($p.author.login) ci=\($ci) \($p.reviewDecision) \($p.mergeStateStatus)" end'

echo "$PRS_JSON" | jq -c --argjson now "$NOW" --arg steward "$STEWARD" \
  --argjson stallMin "$ADVERSARY_STALL_MIN" --argjson stuckH "$PR_STUCK_HOURS" '
  def checks($p): ($p.statusCheckRollup // [] | map(select(.__typename=="CheckRun")));
  .[] | . as $p | (checks($p)) as $c
  | (if ($c|length)==0 then "none"
     elif ($c|any(.conclusion|IN("FAILURE","CANCELLED","TIMED_OUT","STARTUP_FAILURE"))) then "red"
     elif ($c|all(.conclusion=="SUCCESS")) then "green" else "pending" end) as $ci
  | ($c|map(select(.conclusion=="SUCCESS")|.completedAt)|map(fromdateiso8601)|max) as $greenAt
  | (($now-($p.createdAt|fromdateiso8601))/3600) as $ageH
  | (if $greenAt then (($now-$greenAt)/60) else null end) as $greenMin
  | ( if ($p.author.login==$steward and $p.reviewDecision=="REVIEW_REQUIRED" and $ci=="green" and $greenMin!=null and $greenMin>$stallMin)
      then {dedupeKey:"monitor:adversary-review-stall", priority:"P1", repos:["backend","agent"],
            title:"Adversary review not processing green steward PRs",
            description:("External monitor: steward PR #\($p.number) has been CI-green and REVIEW_REQUIRED for \($greenMin|floor)m, longer than a full :20/:50 adversary tick. Green steward PRs are not being converted to approvals, so auto-merge is blocked. Investigate the adversary review schedule (sd_nPDxUUG) run outcomes and PR triage rules (notably the BEHIND-base skip)."),
            evidence:("PR #\($p.number) reviewDecision=REVIEW_REQUIRED, all checks SUCCESS, green \($greenMin|floor)m (>\($stallMin)m), mergeStateStatus=\($p.mergeStateStatus).")}
      else empty end ),
    ( if ($ageH>$stuckH)
      then {dedupeKey:"monitor:stuck-pr:\($p.number)", priority:"P2", repos:["backend","agent"],
            title:"PR #\($p.number) stuck open >\($stuckH)h",
            description:("External monitor: PR #\($p.number) by \($p.author.login) has been open \($ageH|floor)h (merge=\($p.mergeStateStatus), ci=\($ci)) without merging. Investigate CI failure, review deadlock, or a behind-base branch that cannot update."),
            evidence:("PR #\($p.number) open \($ageH|floor)h, mergeStateStatus=\($p.mergeStateStatus), ci=\($ci), reviewDecision=\($p.reviewDecision).")}
      else empty end )' >> "$VIOL_JSONL"

# merge-liveness: empty board + no recent merge = possible work-cycle stall
OPEN_STEWARD="$(echo "$PRS_JSON" | jq --arg s "$STEWARD" '[.[]|select(.author.login==$s)]|length')"
LAST_MERGE_ISO="$(gh api "repos/$REPO/commits?per_page=1" --jq '.[0].commit.committer.date' 2>/dev/null)"
if [ -n "$LAST_MERGE_ISO" ]; then
  LAST_MERGE_EPOCH="$(printf '"%s"' "$LAST_MERGE_ISO" | jq 'fromdateiso8601')"
  MERGE_AGE_H=$(( (NOW - LAST_MERGE_EPOCH) / 3600 ))
  echo "--- merge liveness: last commit ${MERGE_AGE_H}h ago, openStewardPRs=$OPEN_STEWARD ---"
  if [ "$OPEN_STEWARD" -eq 0 ] && [ "$MERGE_AGE_H" -ge "$MERGE_SILENCE_HOURS" ]; then
    jq -nc --argjson h "$MERGE_AGE_H" '{dedupeKey:"monitor:work-cycle-stall", priority:"P1", repos:["backend","agent"],
      title:"Work cycle may be stalled (no merges, empty PR board)",
      description:("External monitor: no open steward PR and no merge to main for \($h)h. The steward work cycle may be failing to open PRs. Investigate work-cycle (sd_CUOT7Vu) run outcomes and pod execution."),
      evidence:("openStewardPRs=0, hours since last merge=\($h) (>= threshold).")}' >> "$VIOL_JSONL"
  fi
fi

# ---------------------------------------------------------------------------
# Layer 2 — Prod-API schedule liveness
# ---------------------------------------------------------------------------
if [ -n "${TDSK_MONITOR_KEY:-}" ]; then
  echo "--- schedule liveness (prod API) ---"
  SCHED_JSON="$(curl -s -H "Authorization: Bearer $TDSK_MONITOR_KEY" \
    "$API_BASE/_/orgs/$ORG/projects/$PROJ/schedules" 2>/dev/null)"
  if echo "$SCHED_JSON" | jq -e '(.data // .) | type=="array"' >/dev/null 2>&1; then
    echo "$SCHED_JSON" | jq -c --argjson now "$NOW" '
      def mingap($xs): [range(1;($xs|length))]|map($xs[.]-$xs[.-1])|min;
      def interval($cron): ($cron|split(" ")) as $f | $f[0] as $min | ($f[1]//"*") as $hr
        | if $hr=="*" then (if ($min|test("\\*/")) then ($min|ltrimstr("*/")|tonumber)
             elif ($min|test(",")) then (mingap($min|split(",")|map(tonumber)|sort)) else 60 end)
          elif ($hr|test("\\*/")) then (($hr|ltrimstr("*/")|tonumber)*60) else 1440 end;
      (.data // .)[] | select(.enabled==true) | . as $s
      | (interval($s.cronExpression)) as $iv
      | (($iv*2.5)|floor|(if .<30 then 30 else . end)|(if .>1560 then 1560 else . end)) as $maxgap
      | (($s.lastRunAt // "1970-01-01T00:00:00Z")|sub("\\.[0-9]+Z$";"Z")|fromdateiso8601) as $last
      | (($now-$last)/60|floor) as $age
      | select($age>$maxgap)
      | {dedupeKey:"monitor:schedule-stall:\($s.id)", priority:"P1", repos:["backend"],
         title:"Schedule \($s.id) overdue (cron \($s.cronExpression))",
         description:("External monitor: schedule \($s.id) (cron \($s.cronExpression), agent \($s.agentId)) last ran \($age)m ago, exceeding its expected max gap of \($maxgap)m (2.5x cadence). A stalled schedule disables an autonomy faculty. Investigate the scheduler tick and this schedule'"'"'s recent run outcomes."),
         evidence:("schedule \($s.id) enabled=true lastRunAt=\($s.lastRunAt) = \($age)m ago > \($maxgap)m.")}
    ' >> "$VIOL_JSONL"
  else
    jq -nc '{dedupeKey:"monitor:prod-api-unreachable", priority:"P2", repos:["backend","proxy"],
      title:"Monitor cannot read schedules from prod API",
      description:"External monitor: the schedules endpoint returned no usable data (auth/scope error or backend/proxy outage). Schedule liveness cannot be verified.",
      evidence:"GET /_/orgs/'"$ORG"'/projects/'"$PROJ"'/schedules returned non-array."}' >> "$VIOL_JSONL"
  fi
fi

# ---------------------------------------------------------------------------
# Process violations — file a proposal per issue (dedup-guarded), report, exit
# ---------------------------------------------------------------------------
COUNT="$(grep -c . "$VIOL_JSONL" 2>/dev/null)"; COUNT="${COUNT:-0}"
echo "=== VERDICT ==="
if [ "$COUNT" -eq 0 ]; then echo "HEALTHY: all invariants pass"; exit 0; fi
echo "UNHEALTHY: $COUNT violation(s) — filing proposals"

BACKLOG='[]'
if [ -n "${TDSK_MONITOR_KEY:-}" ]; then
  BACKLOG="$(curl -s -H "Authorization: Bearer $TDSK_MONITOR_KEY" \
    "$API_BASE/_/orgs/$ORG/task-proposals?limit=200" 2>/dev/null \
    | jq -c 'if (.data|type)=="array" then .data elif type=="array" then . else [] end' 2>/dev/null)"
  [ -z "$BACKLOG" ] && BACKLOG='[]'
fi

while IFS= read -r v; do
  [ -z "$v" ] && continue
  DK="$(echo "$v" | jq -r '.dedupeKey')"
  TITLE="$(echo "$v" | jq -r '.title')"
  printf -- '- [%s] %s\n' "$DK" "$TITLE" >> "$HUMAN_REPORT"
  echo "VIOL $TITLE ($DK)"

  if [ -z "${TDSK_MONITOR_KEY:-}" ]; then continue; fi

  EXISTS="$(echo "$BACKLOG" | jq --arg k "$DK" '[.[]?|select((type=="object") and .dedupeKey==$k and (.status=="pending" or .status=="scanned" or .status=="promoted"))]|length' 2>/dev/null)"
  if [ "${EXISTS:-0}" -gt 0 ]; then echo "  proposal already active for $DK — skip"; continue; fi

  BODY="$(echo "$v" | jq --arg aid "$AGENT" '{agentId:$aid, title, description, evidence, priority, sourceSignal:"health", dedupeKey, repos, meta:{source:"external-monitor"}}')"
  if [ -n "${MONITOR_DRY_RUN:-}" ]; then
    echo "  DRY_RUN would POST: $BODY"; continue
  fi
  RESP="$(curl -s -X POST -H "Authorization: Bearer $TDSK_MONITOR_KEY" -H 'Content-Type: application/json' \
    -d "$BODY" "$API_BASE/_/orgs/$ORG/task-proposals" -w '\n%{http_code}')"
  CODE="$(echo "$RESP" | tail -1)"
  INFO="$(echo "$RESP" | sed '$d' | jq -rc '{id:.data.id, status:.data.status, deduped}' 2>/dev/null || echo '?')"
  echo "  POST -> HTTP $CODE $INFO"
done < "$VIOL_JSONL"

exit 1
