---
name: "fix-tests"
description: "Fix failing integration tests using saved output from .temp/tests-output.txt. Use when asked to fix integration tests, investigate test failures, debug failing tests, or when the user says 'fix the tests' or 'fix the integration tests'. Reads pre-saved test output so tests don't need to be re-run."
---

# Fix Integration Tests

## What This Skill Does

Reads failed test output from `.temp/tests-output.txt`, identifies which tests are failing and why, then investigates and fixes the root causes. The user runs tests manually and pastes output into that file — this skill avoids re-running tests and jumps straight to investigation.

## Workflow

### Step 1: Read the Failed Output

Read `.temp/tests-output.txt` from the project root to get the latest test failure output.

If the file doesn't exist or is empty, tell the user:
> No test output found at `.temp/tests-output.txt`. Run your tests and paste the failure output into that file, then try again.

### Step 2: Parse Failures

Extract from the output:
- **Which test files** failed (e.g., `src/tier3/sandbox-runtime-pod.test.ts`)
- **Which test names** failed (e.g., `pod has TDSK_RUNTIME env var set`)
- **The assertion or error** for each failure (e.g., `expected true to be false`)
- **The line numbers** where failures occurred
- **Whether failures are cascading** from a shared setup failure (look for `setupFailed` guard patterns — if the first test in a suite fails setup, all subsequent tests in that suite will also fail with the same guard assertion)

### Step 3: Load Context

1. Load the `tdsk-integration` skill for test infrastructure knowledge
2. Read the failing test file(s) to understand what they're testing
3. Read the source code being tested — trace from the test assertions back to the implementation

### Step 4: Investigate Root Causes

**Do NOT blame or report on who/what broke the tests.** It doesn't matter. The only goal is to ensure the logic the test was validating is accurate and working as expected.

For each failure, determine which of these two cases applies:
1. **The application code has a bug** — the test expectation is correct but the implementation doesn't satisfy it. Fix the application code.
2. **The test is outdated** — the application code changed (new fields, renamed properties, different behavior) and the test hasn't been updated to match. Update the test to align with the current implementation.

**CRITICAL**: Follow the project's "no fixes without proven root cause" rule:
- Identify the actual root cause, not symptoms — an assumption is NOT a confirmation
- Must gather actual evidence (read the test, read the implementation, compare) BEFORE any code change
- If you can't prove the root cause, say so and gather more data — do NOT guess and code

To make this determination:
- Read the failing test to understand what it asserts
- Read the current application code it's testing
- Compare: does the test expectation match what the code *should* do now?
- If tests cascade from a setup failure, focus on the setup — not the individual test assertions
- If you can't determine which case applies from the output alone, say so and suggest what additional information is needed (logs, K8s pod state, etc.)

### Step 5: Fix

- If the test is outdated: update the test expectations to match current application behavior
- If the application has a bug: fix the application code in the relevant sub-repo
- Both cases may apply across different failures — handle each independently
- Run type checks on affected repos (`pnpm types` in the sub-repo) before reporting completion

### Step 6: Report

Summarize:
- What failed and why
- What you changed and where
- Which files were modified
- Remind the user to re-run the tests to verify the fix

## Key Rules

- **NEVER re-run integration tests** — that's the user's job. Work from the saved output only.
- **NEVER use fake API keys** — real keys come from env vars via `loadEnvs()`
- **NEVER add TODO comments** — implement fully or explain why you can't
- **NEVER commit** — user handles all git operations
- K8s services are always running — don't suggest starting them
- If multiple test files fail, investigate whether they share a common root cause before fixing each independently
