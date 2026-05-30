# Sandbox File Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mutagen-based file synchronization between a user's local machine and K8s sandbox pods, integrated into the `tsa` CLI as both a standalone command (`tsa sync`) and auto-start on `tsa ssh`.

**Architecture:** Mutagen syncs files over the existing SSH tunnel (`tsa proxy` ProxyCommand → WebSocket → TCP:2222). A `MutagenClient` abstraction executes the mutagen binary via `child_process.execFile` behind an `IMutagenClient` interface. `SyncManager` orchestrates lifecycle — config resolution, session creation, monitoring, and cleanup. Hybrid config merges local `tsa.yaml` rules with DB-stored `config.sync`.

**Tech Stack:** TypeScript, `@nuanced-dev/mutagen` (Mutagen CLI wrapper), Drizzle ORM (schema), Express 5 (backend), `@keg-hub/args-parse` (CLI args), Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-04-05-sandbox-file-sync-design.md`

**CRITICAL RULES (apply to ALL tasks and ALL subagents):**
- **NEVER** run `git commit`, `git push`, `git reset`, `git revert`, `git rebase`, `git cherry-pick`, `git stash`, `git merge`
- **ALLOWED**: `git add`, `git status`, `git diff`, `git log`, `git branch`, `git show`
- **NEVER** leave TODO/FIXME comments in code — implement fully or explain why you can't
- **NEVER** save files to the project root — use appropriate subdirectories
- Run `pnpm types` to validate TypeScript before marking any task complete

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `repos/domain/src/types/sync.types.ts` | All sync-related types: `TSyncMode`, `TSyncStatus`, `TSyncSessionOpts`, `TSyncSession`, `TSandboxSyncDefaults`, `TSyncRule`, `TSyncConfig`, `IMutagenClient` |
| `repos/repl/src/services/sync/mutagenClient.ts` | `IMutagenClient` interface re-export + `CliDriver` implementation |
| `repos/repl/src/services/sync/ignoreResolver.ts` | Merge built-in defaults + sandbox defaults + rule ignores, process `!` negations |
| `repos/repl/src/services/sync/configLoader.ts` | Load local `tsa.yaml` sync config, fetch sandbox `syncDefaults` from API, merge per resolution order |
| `repos/repl/src/services/sync/syncManager.ts` | Orchestrate sync lifecycle: resolve config, create/terminate Mutagen sessions, monitor pod state, cleanup |
| `repos/repl/src/tasks/sync.ts` | `tsa sync` task with subtasks: start (default), stop, status, flush |
| `repos/repl/src/services/sync/ignoreResolver.test.ts` | Unit tests for ignore resolution |
| `repos/repl/src/services/sync/configLoader.test.ts` | Unit tests for config merging |
| `repos/repl/src/services/sync/mutagenClient.test.ts` | Unit tests for CliDriver (mocked mutagen calls) |
| `repos/repl/src/services/sync/syncManager.test.ts` | Unit tests for SyncManager lifecycle |

### Modified Files

| File | Change |
|---|---|
| `repos/domain/src/types/sandbox.types.ts` | Add `syncDefaults` to `TKubeSandboxConfig` or sandbox record type |
| `repos/domain/src/types/index.ts` | Export new `sync.types.ts` |
| `repos/database/src/schemas/sandboxes.ts` | Add `syncDefaults` JSONB column |
| `repos/backend/src/endpoints/sandboxes/createSandbox.ts` | Accept `syncDefaults` in body |
| `repos/backend/src/endpoints/sandboxes/updateSandbox.ts` | Accept `syncDefaults` in body |
| `repos/repl/src/tasks/index.ts` | Register `sync` task |
| `repos/repl/src/tasks/ssh.ts` | Add autoStart sync integration |
| `repos/repl/src/services/api.ts` | Add `getSandbox()` method if not present |
| `repos/repl/src/types/config.types.ts` | Add `sync` to `TReplConfig` |
| `repos/repl/package.json` | Add `@nuanced-dev/mutagen` dependency |
| `deploy/Dockerfile.sandbox-base` | Add mutagen-agent binary install |
| `TASKS.md` | Add deferred items |

---

## Task 1: Domain Types

**Files:**
- Create: `repos/domain/src/types/sync.types.ts`
- Modify: `repos/domain/src/types/index.ts`

- [ ] **Step 1: Create sync types file**

```typescript
// repos/domain/src/types/sync.types.ts

export type TSyncMode = 'one-way-replica' | 'one-way-safe' | 'two-way-safe' | 'two-way-resolved'

export type TSyncStatus =
  | 'watching'
  | 'scanning'
  | 'staging'
  | 'syncing'
  | 'idle'
  | 'paused'
  | 'errored'
  | 'disconnected'

export type TSandboxSyncDefaults = {
  targetBase?: string
  ignores?: string[]
  mode?: TSyncMode
}

export type TSyncRule = {
  name: string
  source: string
  target?: string
  mode?: TSyncMode
  ignores?: string[]
}

export type TSyncConfig = {
  autoStart?: boolean
  defaultIgnores?: string[]
  rules?: TSyncRule[]
  sandboxes?: Record<string, { rules?: Partial<TSyncRule>[] }>
}

export type TSyncSessionOpts = {
  name: string
  source: string
  target: string
  sandboxId: string
  mode: TSyncMode
  ignores: string[]
  labels: Record<string, string>
  stageMode?: 'neighboring' | 'mutagen'
}

export type TSyncSession = {
  id: string
  name: string
  status: TSyncStatus
  source: string
  target: string
  mode: TSyncMode
  labels: Record<string, string>
  errors?: string[]
}

export type IMutagenClient = {
  createSession(opts: TSyncSessionOpts): Promise<TSyncSession>
  terminateSession(sessionId: string): Promise<void>
  pauseSession(sessionId: string): Promise<void>
  resumeSession(sessionId: string): Promise<void>
  flushSession(sessionId: string): Promise<void>
  listSessions(labels?: Record<string, string>): Promise<TSyncSession[]>
  getSession(sessionId: string): Promise<TSyncSession | null>
  ensureDaemon(): Promise<void>
  stopDaemon(): Promise<void>
}
```

- [ ] **Step 2: Export from domain index**

Read `repos/domain/src/types/index.ts` and add the export. The file uses barrel exports — add:

```typescript
export * from './sync.types'
```

- [ ] **Step 3: Add syncDefaults to sandbox types**

Read `repos/domain/src/types/sandbox.types.ts`. Find the type used for sandbox DB records (look for the type that includes `name`, `orgId`, `config`). Add `syncDefaults` as an optional property:

```typescript
syncDefaults?: TSandboxSyncDefaults
```

Import `TSandboxSyncDefaults` from `./sync.types` at the top of the file.

- [ ] **Step 4: Validate types compile**

Run: `cd repos/domain && pnpm types`
Expected: Clean exit, no type errors

---

## Task 2: Database Schema

**Files:**
- Modify: `repos/database/src/schemas/sandboxes.ts`

- [ ] **Step 1: Read the current schema**

Read `repos/database/src/schemas/sandboxes.ts` in full to understand the exact column definitions and imports.

- [ ] **Step 2: Add sync defaults to existing config JSONB**

Sync defaults are stored in the existing `config` JSONB column as `TKubeSandboxConfig.sync`. No new Drizzle column is needed — `TSandboxSyncDefaults` is stored within the existing `config` field under the `sync` key.

- [ ] **Step 3: Validate types compile**

Run: `cd repos/database && pnpm types`
Expected: Clean exit, no type errors

- [ ] **Step 4: Note for user**

Output message: "Database schema updated. Run `cd repos/database && pnpm push` manually to push the schema change to the database. This is an interactive command that requires manual confirmation."

---

## Task 3: Backend Endpoint Updates

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/createSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/updateSandbox.ts`

- [ ] **Step 1: Read createSandbox.ts**

Read `repos/backend/src/endpoints/sandboxes/createSandbox.ts` in full.

- [ ] **Step 2: Update createSandbox to accept syncDefaults**

Find where `req.body` is destructured (look for `const { name, config, projectId } = req.body` or similar). Add `syncDefaults` to the destructured properties. Pass it through to the database insert call alongside the existing fields.

No validation needed beyond what JSONB provides — the type system enforces the shape at compile time.

- [ ] **Step 3: Read updateSandbox.ts**

Read `repos/backend/src/endpoints/sandboxes/updateSandbox.ts` in full.

- [ ] **Step 4: Update updateSandbox to accept syncDefaults**

Same pattern as createSandbox — add `syncDefaults` to destructured body and pass through to the database update call. Only include it in the update if it's present in the request body (same pattern as other optional fields like `name`, `config`).

- [ ] **Step 5: Validate types compile**

Run: `cd repos/backend && pnpm types`
Expected: Clean exit, no type errors

---

## Task 4: IgnoreResolver

**Files:**
- Create: `repos/repl/src/services/sync/ignoreResolver.ts`
- Create: `repos/repl/src/services/sync/ignoreResolver.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// repos/repl/src/services/sync/ignoreResolver.test.ts
import { describe, it, expect } from 'vitest'
import { resolveIgnores, BUILTIN_IGNORES } from './ignoreResolver'

describe('resolveIgnores', () => {
  it('returns builtin defaults when no additional ignores provided', () => {
    const result = resolveIgnores({})
    expect(result).toEqual(BUILTIN_IGNORES)
  })

  it('appends sandbox-level ignores after builtins', () => {
    const result = resolveIgnores({ sandboxIgnores: ['vendor/'] })
    expect(result).toEqual([...BUILTIN_IGNORES, 'vendor/'])
  })

  it('appends config-level default ignores after sandbox ignores', () => {
    const result = resolveIgnores({
      sandboxIgnores: ['vendor/'],
      configDefaultIgnores: ['tmp/'],
    })
    expect(result).toEqual([...BUILTIN_IGNORES, 'vendor/', 'tmp/'])
  })

  it('appends rule-specific ignores last', () => {
    const result = resolveIgnores({
      ruleIgnores: ['dist/', '*.map'],
    })
    expect(result).toEqual([...BUILTIN_IGNORES, 'dist/', '*.map'])
  })

  it('processes ! negations by removing matching patterns from earlier layers', () => {
    const result = resolveIgnores({
      ruleIgnores: ['!node_modules/'],
    })
    expect(result).not.toContain('node_modules/')
    expect(result).not.toContain('!node_modules/')
  })

  it('deduplicates patterns', () => {
    const result = resolveIgnores({
      sandboxIgnores: ['.git/'],
      configDefaultIgnores: ['.git/'],
    })
    const gitCount = result.filter(p => p === '.git/').length
    expect(gitCount).toBe(1)
  })

  it('skips builtins when skipDefaults is true', () => {
    const result = resolveIgnores({ skipDefaults: true, ruleIgnores: ['dist/'] })
    expect(result).toEqual(['dist/'])
    expect(result).not.toContain('.git/')
  })

  it('handles all layers combined with negation', () => {
    const result = resolveIgnores({
      sandboxIgnores: ['vendor/'],
      configDefaultIgnores: ['tmp/'],
      ruleIgnores: ['dist/', '!.env'],
    })
    expect(result).toContain('vendor/')
    expect(result).toContain('tmp/')
    expect(result).toContain('dist/')
    expect(result).not.toContain('.env')
    expect(result).not.toContain('!.env')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/repl && npx vitest run src/services/sync/ignoreResolver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ignoreResolver**

```typescript
// repos/repl/src/services/sync/ignoreResolver.ts

export const BUILTIN_IGNORES = [
  '.git/',
  'node_modules/',
  '.DS_Store',
  '*.swp',
  '*.swo',
  '*~',
  '.env',
  '.env.local',
]

type TResolveIgnoresOpts = {
  sandboxIgnores?: string[]
  configDefaultIgnores?: string[]
  ruleIgnores?: string[]
  skipDefaults?: boolean
}

export const resolveIgnores = (opts: TResolveIgnoresOpts): string[] => {
  const {
    sandboxIgnores = [],
    configDefaultIgnores = [],
    ruleIgnores = [],
    skipDefaults = false,
  } = opts

  // Separate negations from regular patterns in rule ignores
  const negations = ruleIgnores.filter(p => p.startsWith('!')).map(p => p.slice(1))
  const rulePositive = ruleIgnores.filter(p => !p.startsWith('!'))

  // Build layers in resolution order
  const layers = [
    ...(skipDefaults ? [] : BUILTIN_IGNORES),
    ...sandboxIgnores,
    ...configDefaultIgnores,
    ...rulePositive,
  ]

  // Remove patterns that match negations
  const filtered = layers.filter(p => !negations.includes(p))

  // Deduplicate while preserving order
  return [...new Set(filtered)]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/repl && npx vitest run src/services/sync/ignoreResolver.test.ts`
Expected: All 7 tests PASS

---

## Task 5: ConfigLoader

**Files:**
- Create: `repos/repl/src/services/sync/configLoader.ts`
- Create: `repos/repl/src/services/sync/configLoader.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// repos/repl/src/services/sync/configLoader.test.ts
import { describe, it, expect } from 'vitest'
import { mergeRules, resolveSourcePath } from './configLoader'
import type { TSyncRule, TSandboxSyncDefaults } from '@tdsk/domain'

describe('mergeRules', () => {
  it('returns config rules when no sandbox defaults exist', () => {
    const rules: TSyncRule[] = [
      { name: 'app', source: './src', target: '/workspace/src', mode: 'one-way-replica' },
    ]
    const result = mergeRules(rules, undefined, undefined)
    expect(result).toEqual(rules)
  })

  it('applies sandbox default targetBase when rule has no target', () => {
    const rules: TSyncRule[] = [{ name: 'app', source: './src' }]
    const defaults: TSandboxSyncDefaults = { targetBase: '/workspace/custom' }
    const result = mergeRules(rules, defaults, undefined)
    expect(result[0].target).toBe('/workspace/custom')
  })

  it('applies sandbox default mode when rule has no mode', () => {
    const rules: TSyncRule[] = [{ name: 'app', source: './src' }]
    const defaults: TSandboxSyncDefaults = { mode: 'two-way-safe' }
    const result = mergeRules(rules, defaults, undefined)
    expect(result[0].mode).toBe('two-way-safe')
  })

  it('rule-level target/mode wins over sandbox defaults', () => {
    const rules: TSyncRule[] = [
      { name: 'app', source: './src', target: '/app', mode: 'one-way-safe' },
    ]
    const defaults: TSandboxSyncDefaults = { targetBase: '/workspace', mode: 'two-way-safe' }
    const result = mergeRules(rules, defaults, undefined)
    expect(result[0].target).toBe('/app')
    expect(result[0].mode).toBe('one-way-safe')
  })

  it('applies per-sandbox overrides by matching rule name', () => {
    const rules: TSyncRule[] = [
      { name: 'app', source: './src', target: '/workspace/src' },
    ]
    const sandboxOverrides: Partial<TSyncRule>[] = [
      { name: 'app', target: '/workspace/custom', ignores: ['vendor/'] },
    ]
    const result = mergeRules(rules, undefined, sandboxOverrides)
    expect(result[0].target).toBe('/workspace/custom')
    expect(result[0].ignores).toEqual(['vendor/'])
  })

  it('falls back to /workspace as default target', () => {
    const rules: TSyncRule[] = [{ name: 'app', source: './src' }]
    const result = mergeRules(rules, undefined, undefined)
    expect(result[0].target).toBe('/workspace')
  })

  it('falls back to one-way-replica as default mode', () => {
    const rules: TSyncRule[] = [{ name: 'app', source: './src' }]
    const result = mergeRules(rules, undefined, undefined)
    expect(result[0].mode).toBe('one-way-replica')
  })
})

describe('resolveSourcePath', () => {
  it('resolves relative path against cwd', () => {
    const result = resolveSourcePath('./src', '/home/user/project')
    expect(result).toBe('/home/user/project/src')
  })

  it('preserves absolute path as-is', () => {
    const result = resolveSourcePath('/absolute/path', '/home/user/project')
    expect(result).toBe('/absolute/path')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/repl && npx vitest run src/services/sync/configLoader.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement configLoader**

```typescript
// repos/repl/src/services/sync/configLoader.ts
import { resolve, isAbsolute } from 'path'
import type { TSyncRule, TSandboxSyncDefaults } from '@tdsk/domain'

const DEFAULT_TARGET = '/workspace'
const DEFAULT_MODE = 'one-way-replica' as const

export const resolveSourcePath = (source: string, cwd: string): string => {
  return isAbsolute(source) ? source : resolve(cwd, source)
}

export const mergeRules = (
  rules: TSyncRule[],
  sandboxDefaults: TSandboxSyncDefaults | undefined,
  sandboxOverrides: Partial<TSyncRule>[] | undefined,
): TSyncRule[] => {
  return rules.map(rule => {
    // Find per-sandbox override by name match
    const override = sandboxOverrides?.find(o => o.name === rule.name)

    // Merge: override > rule > sandbox defaults > built-in defaults
    return {
      name: rule.name,
      source: override?.source || rule.source,
      target: override?.target || rule.target || sandboxDefaults?.targetBase || DEFAULT_TARGET,
      mode: override?.mode || rule.mode || sandboxDefaults?.mode || DEFAULT_MODE,
      ignores: override?.ignores || rule.ignores,
    }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/repl && npx vitest run src/services/sync/configLoader.test.ts`
Expected: All 8 tests PASS

---

## Task 6: MutagenClient CliDriver

**Files:**
- Create: `repos/repl/src/services/sync/mutagenClient.ts`
- Create: `repos/repl/src/services/sync/mutagenClient.test.ts`
- Modify: `repos/repl/package.json`

- [ ] **Step 1: Add @nuanced-dev/mutagen dependency**

Run: `cd repos/repl && pnpm add @nuanced-dev/mutagen`

Note: The dependency is for binary discovery in dev, not for API usage at runtime. The `CliDriver` executes the mutagen binary directly via `child_process.execFile` rather than using the npm wrapper's `mutagen()` function (which crashes in Bun-compiled binaries).

- [ ] **Step 2: Write the failing tests**

```typescript
// repos/repl/src/services/sync/mutagenClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @nuanced-dev/mutagen before importing CliDriver
const mockMutagen = vi.fn()
vi.mock('@nuanced-dev/mutagen', () => ({
  mutagen: mockMutagen,
}))

import { CliDriver } from './mutagenClient'
import type { TSyncSessionOpts } from '@tdsk/domain'

describe('CliDriver', () => {
  let driver: CliDriver

  beforeEach(() => {
    driver = new CliDriver()
    mockMutagen.mockReset()
  })

  describe('createSession', () => {
    it('builds correct mutagen args from session opts', async () => {
      mockMutagen.mockResolvedValue({ stdout: '' })

      const opts: TSyncSessionOpts = {
        name: 'app-source',
        source: '/home/user/src',
        target: '/workspace/src',
        sandboxId: 'sb_abc123',
        mode: 'one-way-replica',
        ignores: ['.git/', 'node_modules/'],
        labels: { sandboxId: 'sb_abc123', ruleName: 'app-source' },
      }

      await driver.createSession(opts)

      expect(mockMutagen).toHaveBeenCalledOnce()
      const args = mockMutagen.mock.calls[0][0] as string[]

      expect(args[0]).toBe('sync')
      expect(args[1]).toBe('create')
      expect(args).toContain('--name=app-source')
      expect(args).toContain('--mode=one-way-replica')
      expect(args).toContain('--stage-mode-beta=neighboring')
      expect(args).toContain('--ignore=.git/')
      expect(args).toContain('--ignore=node_modules/')
      expect(args).toContain('--label=sandboxId=sb_abc123')
      expect(args).toContain('--label=ruleName=app-source')
      expect(args).toContain('/home/user/src')
      expect(args).toContain('sandbox@sb_abc123:/workspace/src')
    })

    it('uses custom stageMode when provided', async () => {
      mockMutagen.mockResolvedValue({ stdout: '' })

      await driver.createSession({
        name: 'test',
        source: '/src',
        target: '/dst',
        sandboxId: 'sb_1',
        mode: 'two-way-safe',
        ignores: [],
        labels: {},
        stageMode: 'mutagen',
      })

      const args = mockMutagen.mock.calls[0][0] as string[]
      expect(args).toContain('--stage-mode-beta=mutagen')
    })
  })

  describe('terminateSession', () => {
    it('calls mutagen sync terminate with session id', async () => {
      mockMutagen.mockResolvedValue({ stdout: '' })
      await driver.terminateSession('session-123')
      expect(mockMutagen).toHaveBeenCalledWith(['sync', 'terminate', 'session-123'])
    })
  })

  describe('pauseSession', () => {
    it('calls mutagen sync pause with session id', async () => {
      mockMutagen.mockResolvedValue({ stdout: '' })
      await driver.pauseSession('session-123')
      expect(mockMutagen).toHaveBeenCalledWith(['sync', 'pause', 'session-123'])
    })
  })

  describe('resumeSession', () => {
    it('calls mutagen sync resume with session id', async () => {
      mockMutagen.mockResolvedValue({ stdout: '' })
      await driver.resumeSession('session-123')
      expect(mockMutagen).toHaveBeenCalledWith(['sync', 'resume', 'session-123'])
    })
  })

  describe('flushSession', () => {
    it('calls mutagen sync flush with session id', async () => {
      mockMutagen.mockResolvedValue({ stdout: '' })
      await driver.flushSession('session-123')
      expect(mockMutagen).toHaveBeenCalledWith(['sync', 'flush', 'session-123'])
    })
  })

  describe('listSessions', () => {
    it('calls mutagen sync list without filter when no labels', async () => {
      mockMutagen.mockResolvedValue({ stdout: '' })
      await driver.listSessions()
      expect(mockMutagen).toHaveBeenCalledWith(['sync', 'list'])
    })

    it('adds label-selector when labels provided', async () => {
      mockMutagen.mockResolvedValue({ stdout: '' })
      await driver.listSessions({ sandboxId: 'sb_abc123' })
      expect(mockMutagen).toHaveBeenCalledWith([
        'sync', 'list', '--label-selector=sandboxId=sb_abc123',
      ])
    })
  })

  describe('ensureDaemon', () => {
    it('calls mutagen daemon start', async () => {
      mockMutagen.mockResolvedValue({ stdout: '' })
      await driver.ensureDaemon()
      expect(mockMutagen).toHaveBeenCalledWith(['daemon', 'start'])
    })
  })

  describe('stopDaemon', () => {
    it('calls mutagen daemon stop', async () => {
      mockMutagen.mockResolvedValue({ stdout: '' })
      await driver.stopDaemon()
      expect(mockMutagen).toHaveBeenCalledWith(['daemon', 'stop'])
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd repos/repl && npx vitest run src/services/sync/mutagenClient.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement CliDriver**

```typescript
// repos/repl/src/services/sync/mutagenClient.ts
// Uses child_process.execFile to run the mutagen binary directly
import type { IMutagenClient, TSyncSessionOpts, TSyncSession } from '@tdsk/domain'

export class CliDriver implements IMutagenClient {
  async createSession(opts: TSyncSessionOpts): Promise<TSyncSession> {
    const args = [
      'sync',
      'create',
      `--name=${opts.name}`,
      `--mode=${opts.mode}`,
      `--stage-mode-beta=${opts.stageMode || 'neighboring'}`,
      ...opts.ignores.map(i => `--ignore=${i}`),
      ...Object.entries(opts.labels).map(([k, v]) => `--label=${k}=${v}`),
      opts.source,
      `sandbox@${opts.sandboxId}:${opts.target}`,
    ]

    await runMutagen(args)

    return {
      id: opts.name,
      name: opts.name,
      status: 'watching',
      source: opts.source,
      target: opts.target,
      mode: opts.mode,
      labels: opts.labels,
    }
  }

  async terminateSession(sessionId: string): Promise<void> {
    await runMutagen(['sync', 'terminate', sessionId])
  }

  async pauseSession(sessionId: string): Promise<void> {
    await runMutagen(['sync', 'pause', sessionId])
  }

  async resumeSession(sessionId: string): Promise<void> {
    await runMutagen(['sync', 'resume', sessionId])
  }

  async flushSession(sessionId: string): Promise<void> {
    await runMutagen(['sync', 'flush', sessionId])
  }

  async listSessions(labels?: Record<string, string>): Promise<TSyncSession[]> {
    const args = ['sync', 'list']
    if (labels) {
      const selector = Object.entries(labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')
      args.push(`--label-selector=${selector}`)
    }
    const result = await runMutagen(args)
    return this.#parseListOutput(result.stdout)
  }

  async getSession(sessionId: string): Promise<TSyncSession | null> {
    const sessions = await this.listSessions()
    return sessions.find(s => s.id === sessionId || s.name === sessionId) || null
  }

  async ensureDaemon(): Promise<void> {
    await runMutagen(['daemon', 'start'])
  }

  async stopDaemon(): Promise<void> {
    await runMutagen(['daemon', 'stop'])
  }

  #parseListOutput(stdout: string): TSyncSession[] {
    if (!stdout.trim()) return []

    // Mutagen list output is human-readable text.
    // Parse session blocks separated by dashes or blank lines.
    // This is a best-effort parser — the GrpcDriver (deferred) will replace this.
    const sessions: TSyncSession[] = []
    const blocks = stdout.split(/\n-{20,}\n/).filter(Boolean)

    for (const block of blocks) {
      const nameMatch = block.match(/Name:\s*(.+)/i)
      const idMatch = block.match(/Identifier:\s*(.+)/i)
      const statusMatch = block.match(/Status:\s*(.+)/i)

      if (nameMatch) {
        sessions.push({
          id: idMatch?.[1]?.trim() || nameMatch[1].trim(),
          name: nameMatch[1].trim(),
          status: this.#mapStatus(statusMatch?.[1]?.trim()),
          source: '',
          target: '',
          mode: 'one-way-replica',
          labels: {},
        })
      }
    }

    return sessions
  }

  #mapStatus(raw?: string): TSyncSession['status'] {
    if (!raw) return 'disconnected'
    const lower = raw.toLowerCase()
    if (lower.includes('watching')) return 'watching'
    if (lower.includes('scanning')) return 'scanning'
    if (lower.includes('staging')) return 'staging'
    if (lower.includes('transitioning') || lower.includes('saving')) return 'syncing'
    if (lower.includes('paused')) return 'paused'
    if (lower.includes('error') || lower.includes('halted')) return 'errored'
    if (lower.includes('disconnected') || lower.includes('connecting')) return 'disconnected'
    return 'idle'
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd repos/repl && npx vitest run src/services/sync/mutagenClient.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 6: Validate types compile**

Run: `cd repos/repl && pnpm types`
Expected: Clean exit, no type errors

---

## Task 7: SyncManager

**Files:**
- Create: `repos/repl/src/services/sync/syncManager.ts`
- Create: `repos/repl/src/services/sync/syncManager.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// repos/repl/src/services/sync/syncManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncManager } from './syncManager'
import type { IMutagenClient, TSyncRule, TSandboxSyncDefaults } from '@tdsk/domain'

const mockClient: IMutagenClient = {
  createSession: vi.fn().mockResolvedValue({ id: 'sess-1', name: 'app', status: 'watching', source: '', target: '', mode: 'one-way-replica', labels: {} }),
  terminateSession: vi.fn().mockResolvedValue(undefined),
  pauseSession: vi.fn().mockResolvedValue(undefined),
  resumeSession: vi.fn().mockResolvedValue(undefined),
  flushSession: vi.fn().mockResolvedValue(undefined),
  listSessions: vi.fn().mockResolvedValue([]),
  getSession: vi.fn().mockResolvedValue(null),
  ensureDaemon: vi.fn().mockResolvedValue(undefined),
  stopDaemon: vi.fn().mockResolvedValue(undefined),
}

describe('SyncManager', () => {
  let manager: SyncManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new SyncManager(mockClient)
  })

  describe('startAll', () => {
    it('ensures daemon is running before creating sessions', async () => {
      const rules: TSyncRule[] = [
        { name: 'app', source: '/src', target: '/workspace/src', mode: 'one-way-replica' },
      ]

      await manager.startAll('sb_abc', 'org_1', rules, undefined)

      expect(mockClient.ensureDaemon).toHaveBeenCalledOnce()
      expect(mockClient.createSession).toHaveBeenCalledOnce()
    })

    it('creates one session per rule with correct labels', async () => {
      const rules: TSyncRule[] = [
        { name: 'app', source: '/src', target: '/workspace/src' },
        { name: 'config', source: '/config', target: '/workspace/config' },
      ]

      await manager.startAll('sb_abc', 'org_1', rules, undefined)

      expect(mockClient.createSession).toHaveBeenCalledTimes(2)

      const firstCall = (mockClient.createSession as any).mock.calls[0][0]
      expect(firstCall.labels).toEqual({ sandboxId: 'sb_abc', ruleName: 'app', orgId: 'org_1' })

      const secondCall = (mockClient.createSession as any).mock.calls[1][0]
      expect(secondCall.labels).toEqual({ sandboxId: 'sb_abc', ruleName: 'config', orgId: 'org_1' })
    })

    it('skips existing sessions with matching labels', async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([
        { id: 'existing', name: 'app', status: 'watching', labels: { sandboxId: 'sb_abc', ruleName: 'app' } },
      ])

      const rules: TSyncRule[] = [
        { name: 'app', source: '/src', target: '/workspace/src' },
      ]

      await manager.startAll('sb_abc', 'org_1', rules, undefined)

      expect(mockClient.createSession).not.toHaveBeenCalled()
    })
  })

  describe('stopAll', () => {
    it('terminates all sessions for a sandbox by label', async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([
        { id: 'sess-1', name: 'app', labels: { sandboxId: 'sb_abc' } },
        { id: 'sess-2', name: 'config', labels: { sandboxId: 'sb_abc' } },
      ])

      await manager.stopAll('sb_abc')

      expect(mockClient.listSessions).toHaveBeenCalledWith({ sandboxId: 'sb_abc' })
      expect(mockClient.terminateSession).toHaveBeenCalledTimes(2)
      expect(mockClient.terminateSession).toHaveBeenCalledWith('sess-1')
      expect(mockClient.terminateSession).toHaveBeenCalledWith('sess-2')
    })

    it('does nothing when no sessions exist', async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([])
      await manager.stopAll('sb_abc')
      expect(mockClient.terminateSession).not.toHaveBeenCalled()
    })
  })

  describe('flushAll', () => {
    it('flushes all sessions for a sandbox', async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([
        { id: 'sess-1', name: 'app', labels: { sandboxId: 'sb_abc' } },
      ])

      await manager.flushAll('sb_abc')

      expect(mockClient.flushSession).toHaveBeenCalledWith('sess-1')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/repl && npx vitest run src/services/sync/syncManager.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SyncManager**

```typescript
// repos/repl/src/services/sync/syncManager.ts
import type { IMutagenClient, TSyncRule, TSandboxSyncDefaults, TSyncSession } from '@tdsk/domain'
import { resolveIgnores } from './ignoreResolver'

export class SyncManager {
  #client: IMutagenClient

  constructor(client: IMutagenClient) {
    this.#client = client
  }

  async startAll(
    sandboxId: string,
    orgId: string,
    rules: TSyncRule[],
    sandboxDefaults: TSandboxSyncDefaults | undefined,
    configDefaultIgnores?: string[],
    skipDefaults?: boolean,
  ): Promise<TSyncSession[]> {
    await this.#client.ensureDaemon()

    // Check for existing sessions to avoid duplicates
    const existing = await this.#client.listSessions({ sandboxId })

    const sessions: TSyncSession[] = []

    for (const rule of rules) {
      const hasExisting = existing.some(
        s => s.labels?.sandboxId === sandboxId && s.labels?.ruleName === rule.name
      )

      if (hasExisting) continue

      const ignores = resolveIgnores({
        sandboxIgnores: sandboxDefaults?.ignores,
        configDefaultIgnores,
        ruleIgnores: rule.ignores,
        skipDefaults,
      })

      const session = await this.#client.createSession({
        name: rule.name,
        source: rule.source,
        target: rule.target || '/workspace',
        sandboxId,
        mode: rule.mode || 'one-way-replica',
        ignores,
        labels: { sandboxId, ruleName: rule.name, orgId },
      })

      sessions.push(session)
    }

    return sessions
  }

  async stopAll(sandboxId: string): Promise<void> {
    const sessions = await this.#client.listSessions({ sandboxId })
    for (const session of sessions) {
      await this.#client.terminateSession(session.id)
    }
  }

  async flushAll(sandboxId: string): Promise<void> {
    const sessions = await this.#client.listSessions({ sandboxId })
    for (const session of sessions) {
      await this.#client.flushSession(session.id)
    }
  }

  async status(sandboxId?: string): Promise<TSyncSession[]> {
    const labels = sandboxId ? { sandboxId } : undefined
    return this.#client.listSessions(labels)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/repl && npx vitest run src/services/sync/syncManager.test.ts`
Expected: All 6 tests PASS

---

## Task 8: Sync CLI Task

**Files:**
- Create: `repos/repl/src/tasks/sync.ts`
- Modify: `repos/repl/src/tasks/index.ts`
- Modify: `repos/repl/src/types/config.types.ts`

- [ ] **Step 1: Read existing task files for patterns**

Read these files in full to match conventions exactly:
- `repos/repl/src/tasks/index.ts`
- `repos/repl/src/tasks/ssh.ts`
- `repos/repl/src/tasks/sandboxes.ts`
- `repos/repl/src/types/config.types.ts`
- `repos/repl/src/services/api.ts`

- [ ] **Step 2: Add TSyncConfig to TReplConfig**

In `repos/repl/src/types/config.types.ts`, add `sync` to the `TReplConfig` type. Import `TSyncConfig` from `@tdsk/domain`:

```typescript
import type { TSyncConfig } from '@tdsk/domain'

// Add to TReplConfig:
sync?: TSyncConfig
```

- [ ] **Step 3: Add getSandbox to ApiClient if not present**

Read `repos/repl/src/services/api.ts`. If `getSandbox(orgId, sandboxId)` does not exist, add it following the existing method patterns:

```typescript
async getSandbox(orgId: string, sandboxId: string) {
  return this.#request<any>(`/orgs/${orgId}/sandboxes/${sandboxId}`)
}
```

- [ ] **Step 4: Implement the sync task**

```typescript
// repos/repl/src/tasks/sync.ts
import type { TTask } from '@TRL/types'
import { themed } from '@TRL/theme'
import { ApiClient } from '@TRL/services/api'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'
import { CliDriver } from '@TRL/services/sync/mutagenClient'
import { SyncManager } from '@TRL/services/sync/syncManager'
import { mergeRules, resolveSourcePath } from '@TRL/services/sync/configLoader'
import type { TSyncRule } from '@tdsk/domain'
import { existsSync } from 'fs'

const driver = new CliDriver()
const manager = new SyncManager(driver)

const stopTask: TTask = {
  name: `stop`,
  description: `Stop file sync sessions`,
  example: `tsa sync stop <sandbox-id>`,
  options: {
    all: {
      type: `bool`,
      description: `Stop all sync sessions`,
      alias: [`a`],
    },
  },
  action: requireAuth(async ({ params, auth, options }) => {
    if (params.all) {
      const sessions = await manager.status()
      for (const s of sessions) {
        await manager.stopAll(s.labels?.sandboxId || s.id)
      }
      process.stdout.write(`${themed(`success`, `All sync sessions stopped`)}\n`)
      return
    }

    const sandboxId = (options?.[0] || params.sandbox) as string
    if (!sandboxId) {
      process.stdout.write(`${themed(`error`, `Usage: tsa sync stop <sandbox-id> or --all`)}\n`)
      process.exit(1)
    }

    await manager.stopAll(sandboxId)
    process.stdout.write(`${themed(`success`, `Sync stopped for ${sandboxId}`)}\n`)
  }),
}

const statusTask: TTask = {
  name: `status`,
  description: `Show sync session status`,
  example: `tsa sync status [sandbox-id]`,
  action: requireAuth(async ({ options }) => {
    const sandboxId = options?.[0] as string | undefined
    const sessions = await manager.status(sandboxId)

    if (sessions.length === 0) {
      process.stdout.write(`${themed(`muted`, `No active sync sessions`)}\n`)
      return
    }

    // Group by sandboxId
    const grouped = new Map<string, typeof sessions>()
    for (const s of sessions) {
      const key = s.labels?.sandboxId || 'unknown'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(s)
    }

    for (const [sbId, group] of grouped) {
      process.stdout.write(`\n${themed(`bold`, `Sandbox: ${sbId}`)}\n`)
      for (const s of group) {
        const icon = s.status === 'errored' || s.status === 'disconnected' ? '⚠' : '●'
        const color = s.status === 'errored' || s.status === 'disconnected' ? 'warning' : 'success'
        process.stdout.write(
          `  ${s.name.padEnd(16)} ${s.source} → ${s.target}  ${s.mode.padEnd(18)} ${themed(color as any, `${icon} ${s.status}`)}\n`
        )
      }
    }
    process.stdout.write(`\n`)
  }),
}

const flushTask: TTask = {
  name: `flush`,
  description: `Force immediate sync cycle`,
  example: `tsa sync flush <sandbox-id>`,
  action: requireAuth(async ({ options, params }) => {
    const sandboxId = (options?.[0] || params.sandbox) as string
    if (!sandboxId) {
      process.stdout.write(`${themed(`error`, `Usage: tsa sync flush <sandbox-id>`)}\n`)
      process.exit(1)
    }
    await manager.flushAll(sandboxId)
    process.stdout.write(`${themed(`success`, `Flush triggered for ${sandboxId}`)}\n`)
  }),
}

export const sync: TTask = {
  name: `sync`,
  alias: [`sy`],
  description: `Sync files with a K8s sandbox`,
  example: `tsa sync <sandbox-id> [--source ./src] [--target /workspace/src]`,
  tasks: {
    stop: stopTask,
    status: statusTask,
    flush: flushTask,
  },
  options: {
    daemon: {
      type: `bool`,
      description: `Run sync in background`,
      alias: [`d`],
      default: false,
    },
    org: {
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`, `o`],
    },
    sandbox: {
      description: `Sandbox ID`,
      alias: [`sandboxId`, `sb`],
    },
    project: {
      description: `Project ID`,
      alias: [`projectId`, `p`],
    },
    source: {
      description: `Local source path (single-rule shorthand)`,
      alias: [`s`, `src`],
    },
    target: {
      description: `Remote target path`,
      alias: [`t`, `tgt`],
      default: `/workspace`,
    },
    mode: {
      description: `Sync mode`,
      alias: [`m`],
      allowed: [`one-way-replica`, `one-way-safe`, `two-way-safe`, `two-way-resolved`],
      default: `one-way-replica`,
    },
    ignore: {
      description: `Ignore patterns (repeatable)`,
      alias: [`i`],
      type: `arr`,
    },
    noDefaults: {
      type: `bool`,
      description: `Skip default ignore patterns`,
      default: false,
    },
    name: {
      description: `Session name`,
      alias: [`n`],
    },
  },
  action: requireAuth(async ({ params, auth, config, options }) => {
    const sandboxId = (params.sandbox || options?.[0]) as string
    if (!sandboxId) {
      process.stdout.write(
        `${themed(`error`, `Usage: tsa sync <sandbox-id> [options]`)}\n` +
        `${themed(`muted`, `  Or configure rules in ~/.config/tdsk/tsa.yaml under sync.rules`)}\n`
      )
      process.exit(1)
    }

    const client = new ApiClient(auth)

    // Resolve org
    let orgId = params.org as string | undefined
    if (!orgId) {
      const orgs = await client.listOrgs()
      if (orgs.length === 1) orgId = orgs[0].id
      else {
        process.stdout.write(`${themed(`error`, `Multiple orgs found. Use --org to specify.`)}\n`)
        process.exit(1)
      }
    }

    // Auto-start pod via connect
    process.stdout.write(`${themed(`muted`, `Connecting to sandbox...`)}\n`)
    await client.connectSandbox(orgId, sandboxId)

    // Fetch sandbox for config.sync defaults
    const sandbox = await client.getSandbox(orgId, sandboxId)
    const syncDefaults = sandbox?.config?.sync

    // Resolve rules: CLI shorthand or config file
    let rules: TSyncRule[]
    const syncConfig = config?.sync

    if (params.source) {
      // Single-rule shorthand from CLI flags
      rules = [{
        name: (params.name as string) || 'cli-sync',
        source: params.source as string,
        target: (params.target as string) || '/workspace',
        mode: (params.mode as any) || 'one-way-replica',
        ignores: (params.ignore as string[]) || [],
      }]
    } else if (syncConfig?.rules?.length) {
      // Get per-sandbox overrides if they exist
      const overrides = syncConfig.sandboxes?.[sandboxId]?.rules
      rules = mergeRules(syncConfig.rules, syncDefaults, overrides)
    } else {
      process.stdout.write(
        `${themed(`error`, `No sync rules configured.`)}\n` +
        `${themed(`muted`, `  Add rules to ~/.config/tdsk/tsa.yaml under sync.rules`)}\n` +
        `${themed(`muted`, `  Or use --source <path> for a quick one-off sync`)}\n`
      )
      process.exit(1)
    }

    // Resolve and validate source paths
    const cwd = process.cwd()
    for (const rule of rules) {
      rule.source = resolveSourcePath(rule.source, cwd)
      if (!existsSync(rule.source)) {
        process.stdout.write(`${themed(`error`, `Source path does not exist: ${rule.source}`)}\n`)
        process.exit(1)
      }
    }

    // Start sync
    const sessions = await manager.startAll(
      sandboxId,
      orgId,
      rules,
      syncDefaults,
      syncConfig?.defaultIgnores,
      params.noDefaults as boolean,
    )

    const total = sessions.length
    process.stdout.write(`${themed(`success`, `File sync started (${total} rule${total !== 1 ? 's' : ''})`)}\n`)

    if (params.daemon) {
      // Daemon mode: print and exit, sessions persist via Mutagen daemon
      for (const s of sessions) {
        process.stdout.write(`  ${themed(`muted`, s.name)} ${s.source} → ${s.target}\n`)
      }
      return
    }

    // Foreground mode: block until Ctrl+C
    process.stdout.write(`${themed(`muted`, `Press Ctrl+C to stop sync`)}\n\n`)

    const cleanup = async () => {
      process.stdout.write(`\n${themed(`muted`, `Stopping sync...`)}\n`)
      await manager.stopAll(sandboxId)
      process.stdout.write(`${themed(`success`, `File sync stopped`)}\n`)
      process.exit(0)
    }

    process.once('SIGINT', cleanup)
    process.once('SIGTERM', cleanup)

    // Keep process alive
    await new Promise(() => {})
  }),
}
```

- [ ] **Step 5: Register sync task in index**

Read `repos/repl/src/tasks/index.ts`. Add the import and registration:

```typescript
import { sync } from './sync'
```

Add `sync` to the `tasks` object alongside the existing entries.

- [ ] **Step 6: Validate types compile**

Run: `cd repos/repl && pnpm types`
Expected: Clean exit, no type errors

---

## Task 9: SSH Auto-Start Integration

**Files:**
- Modify: `repos/repl/src/tasks/ssh.ts`

- [ ] **Step 1: Read the current ssh.ts**

Read `repos/repl/src/tasks/ssh.ts` in full to understand the exact structure.

- [ ] **Step 2: Add sync auto-start integration**

Find the section where the SSH process is spawned (after `client.connectSandbox()` succeeds, before `spawn('ssh', ...)`). Add sync start logic before the SSH spawn and cleanup after it.

Import the needed modules at the top of the file:

```typescript
import { CliDriver } from '@TRL/services/sync/mutagenClient'
import { SyncManager } from '@TRL/services/sync/syncManager'
import { mergeRules, resolveSourcePath } from '@TRL/services/sync/configLoader'
import { existsSync } from 'fs'
```

After the `connectSandbox` call succeeds and before the `spawn('ssh', ...)` call, add:

```typescript
// Auto-start sync if configured
const syncConfig = config?.sync
let syncStarted = false

if (syncConfig?.autoStart && syncConfig?.rules?.length) {
  const driver = new CliDriver()
  const syncManager = new SyncManager(driver)
  const sandbox = await client.getSandbox(orgId, sandboxId)
  const overrides = syncConfig.sandboxes?.[sandboxId]?.rules
  const rules = mergeRules(syncConfig.rules, sandbox?.config?.sync, overrides)

  const cwd = process.cwd()
  const validRules = rules.filter(rule => {
    rule.source = resolveSourcePath(rule.source, cwd)
    return existsSync(rule.source)
  })

  if (validRules.length) {
    const sessions = await syncManager.startAll(
      sandboxId,
      orgId,
      validRules,
      sandbox?.config?.sync,
      syncConfig.defaultIgnores,
    )
    if (sessions.length) {
      syncStarted = true
      process.stdout.write(`${themed(`success`, `File sync started (${sessions.length} rule${sessions.length !== 1 ? 's' : ''})`)}\n`)
    }
  }
}
```

After the SSH process exits (in the `close` handler or after the await that waits for SSH to exit), add sync cleanup:

```typescript
if (syncStarted) {
  const driver = new CliDriver()
  const syncManager = new SyncManager(driver)
  await syncManager.stopAll(sandboxId)
  process.stdout.write(`${themed(`muted`, `File sync stopped`)}\n`)
}
```

- [ ] **Step 3: Validate types compile**

Run: `cd repos/repl && pnpm types`
Expected: Clean exit, no type errors

---

## Task 10: Dockerfile Update

**Files:**
- Modify: `deploy/Dockerfile.sandbox-base`

- [ ] **Step 1: Read the current Dockerfile**

Read `deploy/Dockerfile.sandbox-base` in full.

- [ ] **Step 2: Add mutagen-agent install**

Add the following block after the SSH setup (after `ssh-keygen -A` or the SSH config lines) but before the `USER sandbox` or `ENTRYPOINT` directive. It must run as root since it writes to `/home/sandbox/.mutagen/`:

```dockerfile
# Pre-bake Mutagen agent for file sync
ARG MUTAGEN_VERSION=0.18.1
ARG TARGETOS
ARG TARGETARCH
RUN curl -fsSL \
      https://github.com/mutagen-io/mutagen/releases/download/v${MUTAGEN_VERSION}/mutagen_${TARGETOS}_${TARGETARCH}_v${MUTAGEN_VERSION}.tar.gz \
    | tar xz -C /tmp mutagen-agent \
    && mkdir -p /home/sandbox/.mutagen/agents/${MUTAGEN_VERSION} \
    && mv /tmp/mutagen-agent /home/sandbox/.mutagen/agents/${MUTAGEN_VERSION}/ \
    && chmod 700 /home/sandbox/.mutagen/agents/${MUTAGEN_VERSION}/mutagen-agent \
    && chown -R sandbox:sandbox /home/sandbox/.mutagen
```

- [ ] **Step 3: Verify Dockerfile syntax**

Run: `docker build --check -f deploy/Dockerfile.sandbox-base .` (if available) or visually inspect for syntax errors.

---

## Task 11: Run All Tests

**Files:** None (validation only)

- [ ] **Step 1: Run all repl tests**

Run: `cd repos/repl && pnpm test`
Expected: All existing tests still pass, plus the new sync tests pass.

- [ ] **Step 2: Run domain type checks**

Run: `cd repos/domain && pnpm types`
Expected: Clean exit

- [ ] **Step 3: Run database type checks**

Run: `cd repos/database && pnpm types`
Expected: Clean exit

- [ ] **Step 4: Run backend type checks**

Run: `cd repos/backend && pnpm types`
Expected: Clean exit

- [ ] **Step 5: Run repl type checks**

Run: `cd repos/repl && pnpm types`
Expected: Clean exit

---

## Task 12: Add Deferred Items to TASKS.md

**Files:**
- Modify: `TASKS.md`

- [ ] **Step 1: Read current TASKS.md structure**

Read `TASKS.md` to understand the formatting conventions (priority tags, repo lists, file lists, etc.).

- [ ] **Step 2: Add deferred sync tasks**

Append the following entries to TASKS.md under an appropriate section (e.g., after the existing sandbox-related tasks). Match the existing formatting exactly:

```markdown

### [P3] Sandbox File Sync: `tsa cp` command for one-off file copy

* **Repos**: repl
* **Key files**: New `repos/repl/src/tasks/cp.ts`
* **Depends on**: Sandbox file sync v1 (tsa sync)
* One-off file copy in/out of sandbox via SCP over existing SSH tunnel. Complements `tsa sync` for cases where continuous sync is not needed — e.g., downloading build artifacts or uploading a single config file.
* **Implementation**:
  1. Add `tsa cp <local-path> <sandbox-id>:<remote-path>` for upload
  2. Add `tsa cp <sandbox-id>:<remote-path> <local-path>` for download
  3. Use SCP over existing `tsa proxy` ProxyCommand tunnel
  4. Support glob patterns for multi-file operations
* **Files**:
  * New: `repos/repl/src/tasks/cp.ts` — copy task implementation

### [P3] Sandbox File Sync: Admin UI sync configuration panel

* **Repos**: admin, components
* **Key files**: New `repos/admin/src/components/Sandboxes/SyncDrawer.tsx`
* **Depends on**: Sandbox file sync v1 (tsa sync), syncDefaults API
* Sync configuration drawer in admin sandbox management — set sync direction, default ignores, target paths per sandbox. Uses existing `syncDefaults` JSONB field on sandbox records.
* **Implementation**:
  1. Create `SyncDrawer` component with accordion sections for general settings, ignore patterns (Monaco editor), and path configuration
  2. Add "Configure Sync" action button to sandbox table
  3. Add sync status column to sandbox table (reads from syncDefaults, not live status)
  4. Wire to existing `updateSandbox` API endpoint for saving syncDefaults
* **Files**:
  * New: `repos/admin/src/components/Sandboxes/SyncDrawer.tsx`
  * Modify: `repos/admin/src/components/Sandboxes/Sandboxes.tsx` — add sync column + action

### [P3] Sandbox File Sync: Threads app sync integration

* **Repos**: threads
* **Depends on**: Threads app baseline, sandbox file sync v1
* Sync controls in the Threads app for non-developer users. Scope TBD based on Threads app architecture once baseline is complete.

### [P3] Sandbox File Sync: Real-time sync status streaming

* **Repos**: backend, admin, threads
* **Depends on**: Admin UI sync config, Threads app sync
* Real-time sync status via WebSocket or SSE for UI consumers. Backend tracks sync session state and pushes updates to connected clients.

### [P3] Sandbox File Sync: MutagenClient GrpcDriver

* **Repos**: repl
* **Key files**: New `repos/repl/src/services/sync/grpcDriver.ts`
* **Depends on**: Sandbox file sync v1 stable
* Replace CliDriver with gRPC integration to Mutagen daemon for structured protobuf data and long-polling status updates. Compile Mutagen proto files to TypeScript, connect to daemon socket via `@grpc/grpc-js`.
* **Implementation**:
  1. Compile Mutagen proto files (`pkg/service/synchronization/synchronization.proto` and dependencies) to TypeScript
  2. Implement `GrpcDriver` class implementing `IMutagenClient` interface
  3. Connect to `~/.mutagen/daemon/daemon.sock` via `@grpc/grpc-js`
  4. Use `List` RPC with `previousStateIndex` for long-polling status updates
  5. Swap CliDriver for GrpcDriver in SyncManager (configuration-based selection)
* **Files**:
  * New: `repos/repl/src/services/sync/grpcDriver.ts`
  * New: `repos/repl/src/services/sync/proto/` — compiled proto definitions

### [P3] Sandbox File Sync: File browser UI

* **Repos**: admin, threads, backend
* **Depends on**: Admin UI sync config, Threads app sync
* Browse and download sandbox files from admin and Threads UIs. Uses existing `ISandbox.readFile/listDir` via a new backend endpoint or the existing exec endpoint.

### [P3] Sandbox File Sync: Sync session persistence

* **Repos**: backend, database, domain
* **Depends on**: GrpcDriver or sync status streaming
* Track active sync sessions in backend DB for cross-client visibility. Enables admin/Threads UIs to show which sandboxes have active sync sessions without querying the user's local Mutagen daemon.
```

- [ ] **Step 3: Verify TASKS.md is valid markdown**

Read the file back and verify formatting is consistent with existing entries.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-05-sandbox-file-sync.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?