#!/usr/bin/env bash
# Detect-step unit tests for infra-staging.yml (P4e E2).
# Validates that the regex '^(\.github/workflows/|deploy/)' correctly classifies
# file lists as infra (exit 0) or non-infra (exit 0 for green, but sets infra=false).
#
# Run: bash .github/workflows/__tests__/infra-staging-detect.test.sh
# Exit 0 = all cases pass; exit 1 = one or more cases failed.

set -euo pipefail

PASS=0
FAIL=0

# The same regex used in the detect step of infra-staging.yml
INFRA_PATTERN='^(\.github/workflows/|deploy/)'

# Returns "true" if any line in the newline-separated file list matches INFRA_PATTERN
detect_infra() {
  local files="$1"
  if echo "$files" | grep -E "$INFRA_PATTERN" > /dev/null 2>&1; then
    echo "true"
  else
    echo "false"
  fi
}

run_case() {
  local label="$1"
  local files="$2"
  local expected="$3"

  local result
  result=$(detect_infra "$files")

  if [[ "$result" == "$expected" ]]; then
    echo "PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $label"
    echo "      files:    $files"
    echo "      expected: $expected"
    echo "      got:      $result"
    FAIL=$((FAIL + 1))
  fi
}

# Case 1: pure app files -> non-infra (no-op)
run_case \
  "pure app files -> infra=false" \
  "$(printf 'src/foo.ts\nREADME.md')" \
  "false"

# Case 2: deploy/ file -> infra
run_case \
  "deploy/values.staging.yaml -> infra=true" \
  "deploy/values.staging.yaml" \
  "true"

# Case 3: .github/workflows/ file -> infra
run_case \
  ".github/workflows/deploy-production.yml -> infra=true" \
  ".github/workflows/deploy-production.yml" \
  "true"

# Case 4: mixed - any infra file triggers, even alongside app files
run_case \
  "mixed (app + infra) -> infra=true" \
  "$(printf 'src/foo.ts\ndeploy/values.staging.yaml')" \
  "true"

# Case 5: docs-only -> non-infra
run_case \
  "docs-only -> infra=false" \
  "$(printf 'docs/README.md\ndocs/superpowers/specs/foo.md')" \
  "false"

# Case 6: .claude/ files -> non-infra
run_case \
  ".claude/ files -> infra=false" \
  "$(printf '.claude/settings.local.json\n.claude/agents/security-reviewer.md')" \
  "false"

# Case 7: repo source files -> non-infra
run_case \
  "repos/ source files -> infra=false" \
  "$(printf 'repos/backend/src/routes/agents.ts\nrepos/admin/src/pages/home.tsx')" \
  "false"

# Case 8: new workflow file -> infra
run_case \
  ".github/workflows/infra-staging.yml -> infra=true" \
  ".github/workflows/infra-staging.yml" \
  "true"

# Case 9: deploy/ prefix substring that does NOT start at line start should NOT match
# (e.g. a path like "repos/deploy/something" — the regex anchors with ^)
run_case \
  "repos/deploy/... -> infra=false (^ anchor)" \
  "repos/deploy/something.ts" \
  "false"

# Case 10: multiple workflow files (both infra)
run_case \
  "multiple .github/workflows files -> infra=true" \
  "$(printf '.github/workflows/ci.yml\n.github/workflows/infra-staging.yml')" \
  "true"

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi

exit 0
