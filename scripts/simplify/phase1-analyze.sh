#!/usr/bin/env bash
# Phase 1: Analyze monorepo and generate dependency-aware batch manifest
# Usage: bash scripts/simplify/phase1-analyze.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
MANIFEST="$OUTPUT_DIR/manifest.json"
SYSTEM_PROMPT="$SCRIPT_DIR/prompts/phase1-system.txt"


mkdir -p "$OUTPUT_DIR/logs"

# ── Preflight checks ──────────────────────────────────────────────────────────

if ! command -v claude &>/dev/null; then
  echo "ERROR: 'claude' CLI not found on PATH" >&2
  exit 1
fi

if [[ ! -f "$SYSTEM_PROMPT" ]]; then
  echo "ERROR: System prompt not found at $SYSTEM_PROMPT" >&2
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Phase 1: Dependency-Aware Batch Analysis                    ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Output: $MANIFEST                                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Count source files ─────────────────────────────────────────────────────────

FILE_COUNT=$(find "$ROOT_DIR/repos" -path '*/src/*.ts' -o -path '*/src/*.tsx' \
  | grep -v node_modules \
  | grep -v '__tests__' \
  | grep -v '__mocks__' \
  | grep -v '.test.ts' \
  | grep -v '.spec.ts' \
  | grep -v '/dist/' \
  | wc -l | tr -d ' ')

echo "Found $FILE_COUNT TypeScript source files to analyze"
echo ""

# ── Run Claude analysis session ────────────────────────────────────────────────

echo "Starting Claude analysis session..."
echo "This may take 10-20 minutes depending on codebase size."
echo ""

PHASE1_LOG="$OUTPUT_DIR/logs/phase1-$(date +%Y%m%d-%H%M%S).log"

cd "$ROOT_DIR"

claude -p \
  --system-prompt "$(cat "$SYSTEM_PROMPT")" \
  --allowedTools "Read,Grep,Glob,Bash(read-only commands: find, ls, wc, head, cat)" \
  --permission-mode bypassPermissions \
  --output-format text \
  "Analyze all TypeScript source files in repos/*/src/ and produce the batch manifest JSON. There are approximately $FILE_COUNT files. Remember: output ONLY valid JSON, no markdown fences or commentary." \
  2>"$PHASE1_LOG" | tee "$OUTPUT_DIR/raw-output.txt"

echo ""
echo "Claude session complete. Extracting JSON..."

# ── Extract JSON from output ───────────────────────────────────────────────────

# Claude may output text around the JSON — extract the JSON array
RAW="$OUTPUT_DIR/raw-output.txt"

# Try to find the JSON array in the output
# Look for the first '[' to the last ']'
python3 -c "
import json, sys, re

raw = open('$RAW').read()

# Try to find a JSON array in the output
# First try: the entire output is JSON
try:
    data = json.loads(raw)
    if isinstance(data, list):
        json.dump(data, open('$MANIFEST', 'w'), indent=2)
        print(f'Manifest written: {len(data)} batches')
        sys.exit(0)
except json.JSONDecodeError:
    pass

# Second try: find JSON array between first [ and last ]
start = raw.find('[')
end = raw.rfind(']')
if start != -1 and end != -1 and end > start:
    candidate = raw[start:end+1]
    try:
        data = json.loads(candidate)
        if isinstance(data, list):
            json.dump(data, open('$MANIFEST', 'w'), indent=2)
            print(f'Manifest written: {len(data)} batches')
            sys.exit(0)
    except json.JSONDecodeError:
        pass

# Third try: strip markdown code fences
cleaned = re.sub(r'\`\`\`json?\n?', '', raw)
cleaned = re.sub(r'\`\`\`', '', cleaned).strip()
try:
    data = json.loads(cleaned)
    if isinstance(data, list):
        json.dump(data, open('$MANIFEST', 'w'), indent=2)
        print(f'Manifest written: {len(data)} batches')
        sys.exit(0)
except json.JSONDecodeError:
    pass

print('ERROR: Could not extract valid JSON from Claude output', file=sys.stderr)
print('Raw output saved to: $RAW', file=sys.stderr)
sys.exit(1)
"

# ── Validate manifest ─────────────────────────────────────────────────────────

echo ""
echo "Validating manifest..."

VALIDATION_RESULT=$(python3 -c "
import json, os, sys

manifest = json.load(open('$MANIFEST'))
errors = []
warnings = []
total_files = 0
total_context = 0
repos_seen = set()

for i, batch in enumerate(manifest):
    bid = batch.get('id', f'batch-{i}')

    # Check required fields
    for field in ['id', 'repo', 'description', 'files', 'context_files']:
        if field not in batch:
            errors.append(f'Batch {bid}: missing field \"{field}\"')

    if 'files' not in batch:
        continue

    files = batch['files']
    total_files += len(files)
    repos_seen.add(batch.get('repo', 'unknown'))

    if len(files) == 0:
        warnings.append(f'Batch {bid}: empty files array')
    elif len(files) > 25:
        warnings.append(f'Batch {bid}: {len(files)} files (exceeds 25 max)')

    # Verify files exist
    for f in files:
        path = os.path.join('$ROOT_DIR', f)
        if not os.path.isfile(path):
            errors.append(f'Batch {bid}: file not found: {f}')

    # Verify context files exist
    for f in batch.get('context_files', []):
        path = os.path.join('$ROOT_DIR', f)
        if not os.path.isfile(path):
            warnings.append(f'Batch {bid}: context file not found: {f}')
        total_context += 1

# Check for duplicate files across batches
all_files = []
for batch in manifest:
    all_files.extend(batch.get('files', []))
dupes = set(f for f in all_files if all_files.count(f) > 1)
if dupes:
    errors.append(f'Duplicate files across batches: {dupes}')

print(f'Batches: {len(manifest)}')
print(f'Total files: {total_files}')
print(f'Context files: {total_context}')
print(f'Repos covered: {sorted(repos_seen)}')
print(f'Errors: {len(errors)}')
print(f'Warnings: {len(warnings)}')

if errors:
    print()
    print('ERRORS:')
    for e in errors:
        print(f'  - {e}')

if warnings:
    print()
    print('WARNINGS:')
    for w in warnings[:20]:
        print(f'  - {w}')
    if len(warnings) > 20:
        print(f'  ... and {len(warnings) - 20} more')

sys.exit(1 if errors else 0)
")

echo "$VALIDATION_RESULT"
echo ""

if echo "$VALIDATION_RESULT" | grep -q "^Errors: 0$"; then
  echo "✓ Manifest is valid: $MANIFEST"
  echo ""
  echo "Next steps:"
  echo "  1. Review: cat $MANIFEST | python3 -m json.tool | less"
  echo "  2. Dry run: SIMPLIFY_DRY_RUN=true bash scripts/simplify/phase2-simplify.sh"
  echo "  3. Execute: bash scripts/simplify/phase2-simplify.sh"
else
  echo "✗ Manifest has errors. Fix the issues and re-run, or manually edit $MANIFEST"
  exit 1
fi
