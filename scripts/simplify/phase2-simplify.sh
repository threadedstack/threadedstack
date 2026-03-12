#!/usr/bin/env bash
# Phase 2: Run simplification loop over batch manifest
# Usage: bash scripts/simplify/phase2-simplify.sh
#
# Environment variables:
#   SIMPLIFY_DRY_RUN  - Print plan without executing (default: false)
#   SIMPLIFY_BRANCH   - Git branch name (default: simplify/<timestamp>)
#   RETRY_FAILED      - Re-attempt previously failed batches (default: false)
#   BATCH_FILTER      - Process only batches matching this regex (default: .*)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
MANIFEST="$OUTPUT_DIR/manifest.json"
PROGRESS="$OUTPUT_DIR/progress.json"
SUMMARY="$OUTPUT_DIR/summary.json"
SYSTEM_PROMPT="$SCRIPT_DIR/prompts/phase2-system.txt"
LOGS_DIR="$OUTPUT_DIR/logs"

SIMPLIFY_DRY_RUN="${SIMPLIFY_DRY_RUN:-false}"
SIMPLIFY_BRANCH="${SIMPLIFY_BRANCH:-simplify/$(date +%Y%m%d-%H%M%S)}"
RETRY_FAILED="${RETRY_FAILED:-false}"
BATCH_FILTER="${BATCH_FILTER:-.*}"

# ── Preflight checks ──────────────────────────────────────────────────────────

if ! command -v claude &>/dev/null; then
  echo "ERROR: 'claude' CLI not found on PATH" >&2
  exit 1
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: Manifest not found at $MANIFEST" >&2
  echo "Run phase1-analyze.sh first." >&2
  exit 1
fi

if [[ ! -f "$SYSTEM_PROMPT" ]]; then
  echo "ERROR: System prompt not found at $SYSTEM_PROMPT" >&2
  exit 1
fi

mkdir -p "$LOGS_DIR"

# ── Parse manifest ─────────────────────────────────────────────────────────────

BATCH_COUNT=$(python3 -c "import json; print(len(json.load(open('$MANIFEST'))))")
TOTAL_FILES=$(python3 -c "
import json
m = json.load(open('$MANIFEST'))
print(sum(len(b.get('files', [])) for b in m))
")

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Phase 2: Simplification Loop                                ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Batches:  $BATCH_COUNT                                      ║"
echo "║  Files:    $TOTAL_FILES                                      ║"
echo "║  Branch:   $SIMPLIFY_BRANCH                                  ║"
echo "║  Dry run:  $SIMPLIFY_DRY_RUN                                 ║"
echo "║  Retry:    $RETRY_FAILED                                     ║"
echo "║  Filter:   $BATCH_FILTER                                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Initialize progress tracking ──────────────────────────────────────────────

if [[ ! -f "$PROGRESS" ]]; then
  echo '{"completed":[],"failed":[],"skipped":[],"in_progress":null,"started_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$PROGRESS"
  echo "Initialized progress tracking: $PROGRESS"
else
  echo "Resuming from existing progress: $PROGRESS"
fi

# Helper: read progress arrays
get_completed() { python3 -c "import json; print('\n'.join(json.load(open('$PROGRESS'))['completed']))"; }
get_failed() { python3 -c "import json; print('\n'.join(json.load(open('$PROGRESS'))['failed']))"; }

# Helper: update progress
update_progress() {
  local batch_id="$1"
  local status="$2"  # completed, failed, skipped, in_progress

  python3 -c "
import json

progress = json.load(open('$PROGRESS'))

# Remove from all lists first
for key in ['completed', 'failed', 'skipped']:
    if '$batch_id' in progress[key]:
        progress[key].remove('$batch_id')

if '$status' == 'in_progress':
    progress['in_progress'] = '$batch_id'
elif '$status' in ('completed', 'failed', 'skipped'):
    progress['$status'].append('$batch_id')
    if progress.get('in_progress') == '$batch_id':
        progress['in_progress'] = None

json.dump(progress, open('$PROGRESS', 'w'), indent=2)
"
}

# ── Git branch setup ──────────────────────────────────────────────────────────

if [[ "$SIMPLIFY_DRY_RUN" != "true" ]]; then
  cd "$ROOT_DIR"

  CURRENT_BRANCH=$(git branch --show-current)

  # If already on a simplify branch, stay on it
  if [[ "$CURRENT_BRANCH" == simplify/* ]]; then
    echo "Already on simplify branch: $CURRENT_BRANCH"
    SIMPLIFY_BRANCH="$CURRENT_BRANCH"
  else
    # Check if the branch already exists
    if git show-ref --verify --quiet "refs/heads/$SIMPLIFY_BRANCH" 2>/dev/null; then
      echo "Branch $SIMPLIFY_BRANCH already exists, switching to it"
      git checkout "$SIMPLIFY_BRANCH"
    else
      echo "Creating branch: $SIMPLIFY_BRANCH"
      git checkout -b "$SIMPLIFY_BRANCH"
    fi
  fi
  echo ""
fi

# ── Main loop ─────────────────────────────────────────────────────────────────

COMPLETED=0
FAILED=0
SKIPPED=0
START_TIME=$(date +%s)

for ((i=0; i<BATCH_COUNT; i++)); do
  # Extract batch info
  BATCH_INFO=$(python3 -c "
import json
m = json.load(open('$MANIFEST'))
b = m[$i]
print(b['id'])
print(b['repo'])
print(b.get('description', ''))
print(len(b.get('files', [])))
")

  BATCH_ID=$(echo "$BATCH_INFO" | sed -n '1p')
  BATCH_REPO=$(echo "$BATCH_INFO" | sed -n '2p')
  BATCH_DESC=$(echo "$BATCH_INFO" | sed -n '3p')
  BATCH_FILE_COUNT=$(echo "$BATCH_INFO" | sed -n '4p')

  # Apply batch filter
  if ! echo "$BATCH_ID" | grep -qE "$BATCH_FILTER"; then
    continue
  fi

  # Skip completed batches (unless retrying)
  if get_completed 2>/dev/null | grep -qx "$BATCH_ID"; then
    echo "[$((i+1))/$BATCH_COUNT] SKIP (completed): $BATCH_ID"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Skip failed batches (unless RETRY_FAILED=true)
  if [[ "$RETRY_FAILED" != "true" ]] && get_failed 2>/dev/null | grep -qx "$BATCH_ID"; then
    echo "[$((i+1))/$BATCH_COUNT] SKIP (failed): $BATCH_ID"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "[$((i+1))/$BATCH_COUNT] $BATCH_ID ($BATCH_REPO, $BATCH_FILE_COUNT files)"
  echo "  $BATCH_DESC"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Build the prompt with file list and context files
  BATCH_PROMPT=$(python3 -c "
import json

m = json.load(open('$MANIFEST'))
b = m[$i]

files = b.get('files', [])
context = b.get('context_files', [])

parts = []
parts.append(f'Simplify batch: {b[\"id\"]}')
parts.append(f'Repo: {b[\"repo\"]}')
parts.append(f'Description: {b.get(\"description\", \"\")}')
parts.append('')
parts.append('Files to simplify (you may EDIT these):')
for f in files:
    parts.append(f'  - {f}')
parts.append('')
if context:
    parts.append('Context files (READ-ONLY, do NOT edit):')
    for f in context:
        parts.append(f'  - {f}')
    parts.append('')
parts.append('Process each file: read it, analyze for reuse/quality/efficiency improvements, apply targeted edits using the Edit tool, then move to the next file. Skip files that are already clean. Output a brief summary when done.')

print('\n'.join(parts))
")

  if [[ "$SIMPLIFY_DRY_RUN" == "true" ]]; then
    echo "  [DRY RUN] Would run claude with the above batch"
    echo "$BATCH_PROMPT" | head -20
    echo "  ..."
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Mark in-progress
  update_progress "$BATCH_ID" "in_progress"

  BATCH_LOG="$LOGS_DIR/${BATCH_ID}-$(date +%Y%m%d-%H%M%S).log"
  BATCH_START=$(date +%s)

  # Run Claude simplification session
  set +e
  BATCH_OUTPUT=$(cd "$ROOT_DIR" && claude -p \
    --system-prompt "$(cat "$SYSTEM_PROMPT")" \
    --allowedTools "Read,Edit,Grep,Glob,Bash(read-only commands: find, ls, wc, head, cat)" \
    --permission-mode bypassPermissions \
    --output-format text \
    "$BATCH_PROMPT" \
    2>"$BATCH_LOG.stderr")
  EXIT_CODE=$?
  set -e

  BATCH_END=$(date +%s)
  BATCH_DURATION=$((BATCH_END - BATCH_START))

  # Log output
  {
    echo "=== Batch: $BATCH_ID ==="
    echo "=== Duration: ${BATCH_DURATION}s ==="
    echo "=== Exit code: $EXIT_CODE ==="
    echo ""
    echo "$BATCH_OUTPUT"
  } > "$BATCH_LOG"

  if [[ $EXIT_CODE -eq 0 ]]; then
    echo "  ✓ Completed in ${BATCH_DURATION}s"
    update_progress "$BATCH_ID" "completed"
    COMPLETED=$((COMPLETED + 1))
  else
    echo "  ✗ Failed (exit code $EXIT_CODE) after ${BATCH_DURATION}s"
    echo "  Log: $BATCH_LOG"
    update_progress "$BATCH_ID" "failed"
    FAILED=$((FAILED + 1))
  fi
done

# ── Generate summary ──────────────────────────────────────────────────────────

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

python3 -c "
import json
from datetime import datetime

progress = json.load(open('$PROGRESS'))

summary = {
    'completed_at': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    'total_duration_seconds': $TOTAL_DURATION,
    'total_batches': $BATCH_COUNT,
    'processed': $COMPLETED,
    'failed': $FAILED,
    'skipped': $SKIPPED,
    'completed_ids': progress['completed'],
    'failed_ids': progress['failed'],
}

json.dump(summary, open('$SUMMARY', 'w'), indent=2)
"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Simplification Complete                                   ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Duration:  $((TOTAL_DURATION / 60))m $((TOTAL_DURATION % 60))s"
echo "║  Completed: $COMPLETED"
echo "║  Failed:    $FAILED"
echo "║  Skipped:   $SKIPPED"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Summary:   $SUMMARY"
echo "║  Progress:  $PROGRESS"
echo "║  Logs:      $LOGS_DIR/"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

if [[ $FAILED -gt 0 ]]; then
  echo "Failed batches:"
  python3 -c "
import json
p = json.load(open('$PROGRESS'))
for bid in p['failed']:
    print(f'  - {bid}')
"
  echo ""
  echo "Retry with: RETRY_FAILED=true bash scripts/simplify/phase2-simplify.sh"
fi

echo ""
echo "Post-run validation:"
echo "  git diff --stat"
echo "  pnpm types"
echo "  pnpm test"
echo "  cat $SUMMARY"
