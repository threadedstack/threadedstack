# Automated Simplify Loop

Two-phase system for running code simplification across all TypeScript source files in the monorepo. Files are batched by import dependency so related code is simplified together with full context.

## Quick Start

```bash
# 1. Generate the batch manifest (~10-20 min)
pnpm simplify:analyze

# 2. Preview what will happen
pnpm simplify:dry

# 3. Run the simplification
pnpm simplify

# 4. Review changes
git diff --stat
pnpm types
pnpm test
```

## How It Works

### Phase 1: Analysis (`pnpm simplify:analyze`)

A Claude session scans all `repos/*/src/**/*.ts(x)` files, traces import dependencies using the monorepo's alias resolution table (`@TBE`, `@TDM`, `@TAG`, etc.), and outputs a JSON manifest grouping files into dependency-aware batches.

- Batches are scoped to a single repo (5-15 files each, max 25)
- Cross-repo imports are tracked as read-only `context_files`
- Repos are processed in dependency order: domain/logger → database/components → backend/admin
- Test files, config files, and re-export barrels are excluded

Output: `scripts/simplify/output/manifest.json`

### Phase 2: Simplification (`pnpm simplify`)

Reads the manifest and runs a separate Claude session per batch. Each session:

1. Reads the batch files and their cross-repo context files
2. Applies three simplification concerns: **reuse**, **quality**, **efficiency**
3. Edits files using targeted changes (no wholesale rewrites)
4. Outputs a summary of what changed

All changes land on a dedicated git branch (`simplify/<timestamp>`). Nothing is committed — you review via `git diff` and commit manually.

## Commands

| Command | Description |
|---|---|
| `pnpm simplify:analyze` | Phase 1 — generate batch manifest |
| `pnpm simplify` | Phase 2 — process all batches |
| `pnpm simplify:dry` | Phase 2 dry run — print plan without executing |
| `pnpm simplify:retry` | Phase 2 — retry previously failed batches |

## Environment Variables

Set inline with the command, e.g. `BATCH_FILTER="backend" pnpm simplify`.

| Variable | Default | Description |
|---|---|---|
| `SIMPLIFY_DRY_RUN` | `false` | Print plan without executing |
| `SIMPLIFY_BRANCH` | `simplify/<timestamp>` | Git branch name |
| `RETRY_FAILED` | `false` | Re-attempt failed batches |
| `BATCH_FILTER` | `.*` | Regex to filter batch IDs |

### Examples

```bash
# Only process backend batches
BATCH_FILTER="^backend-" pnpm simplify

# Only process a specific batch
BATCH_FILTER="^domain-models$" pnpm simplify

# Use a named branch
SIMPLIFY_BRANCH="simplify/round-2" pnpm simplify

# Retry failures from a previous run
pnpm simplify:retry
```

## Resume Support

Phase 2 tracks progress in `scripts/simplify/output/progress.json`. If the process is interrupted:

- Re-running `pnpm simplify` skips already-completed batches
- Failed batches are logged and skipped (use `pnpm simplify:retry` to re-attempt them)
- To start fresh, delete `scripts/simplify/output/progress.json`

## Output Files

All runtime output is in `scripts/simplify/output/` (gitignored):

| File | Description |
|---|---|
| `manifest.json` | Batch definitions from Phase 1 |
| `progress.json` | Tracks completed/failed/skipped batches |
| `summary.json` | Final report after Phase 2 completes |
| `raw-output.txt` | Raw Claude output from Phase 1 |
| `logs/<batch-id>-*.log` | Per-batch Claude output |
| `logs/<batch-id>-*.log.stderr` | Per-batch stderr |

## Post-Run Validation

After the loop completes:

```bash
git diff --stat                # What changed
pnpm types                     # Type checking across all repos
pnpm test                      # Unit tests
cat scripts/simplify/output/summary.json  # Run summary
```

If unhappy with results, discard everything:

```bash
git checkout main
git branch -D simplify/<timestamp>
```

## Simplification Rules

Each batch session follows strict rules to prevent breakage:

- Public exports, function signatures, and import patterns are never changed
- Cross-repo context files are read-only (never edited)
- No new dependencies added
- No file renames
- No TODOs or placeholder comments left behind
- Files already clean are skipped

The three simplification concerns, in priority order:

1. **Reuse** — use existing utilities instead of duplicated logic
2. **Quality** — clearer names, simpler control flow, dead code removal
3. **Efficiency** — better data structures, fewer allocations, early returns
