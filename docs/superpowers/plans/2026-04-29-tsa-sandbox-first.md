# TSA CLI Sandbox-First Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL GIT RULE:** NEVER run `git commit`. Stage files with `git add` only. The user handles all commits manually.

**Goal:** Make the TSA CLI sandbox-first by changing the default command, adding auto-login, interactive pickers for org/project/sandbox, and sandbox alias resolution.

**Architecture:** Replace `requireAuth` hard-exit with `ensureAuth` auto-browser-login wrapper. Add interactive TTY pickers to `resolveOrgId` and new `resolveSandboxId`. Rename `run` task to `sandbox`, delete `sandboxes` task. Persist last-used sandbox in config.

**Tech Stack:** Bun, TypeScript, Vitest, `@keg-hub/args-parse`, `readline` (Node built-in)

**Spec:** `docs/superpowers/specs/2026-04-29-tsa-sandbox-first-design.md`

**Note on config naming:** `TTsaConfig` already has `sandbox?: TSandboxConfig` (an object with timeout/provider/envVars). The saved sandbox ID field is named `sandboxId?: string` to avoid collision.

---

### Task 1: Add `sandboxId` to TTsaConfig

**Files:**
- Modify: `repos/tsa/src/types/config.types.ts:47-58`

- [ ] **Step 1: Add `sandboxId` field to `TTsaConfig`**

In `repos/tsa/src/types/config.types.ts`, add `sandboxId` after `project`:

```typescript
export type TTsaConfig = {
  org?: string
  agent?: string
  project?: string
  sandboxId?: string
  auth?: TAuthConfig
  sync?: TSyncConfig
  hooks?: THooksConfig
  tools?: TToolsConfig
  sandbox?: TSandboxConfig
  display?: TDisplayConfig
  behavior?: TBehaviorConfig
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/tsa && pnpm types`
Expected: No errors.

---

### Task 2: Create `ensureAuth`, delete `requireAuth`

**Files:**
- Create: `repos/tsa/src/utils/tasks/ensureAuth.ts`
- Create: `repos/tsa/src/utils/tasks/ensureAuth.test.ts`
- Delete: `repos/tsa/src/utils/tasks/requireAuth.ts`

- [ ] **Step 1: Write tests for `ensureAuth`**

Create `repos/tsa/src/utils/tasks/ensureAuth.test.ts`:

```typescript
import type { TTaskAction, TTaskActionArgs } from '@TSA/types'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ensureAuth } from './ensureAuth'

const mockBrowserLogin = vi.fn()
vi.mock(`@TSA/services/browserAuth`, () => ({
  browserLogin: (...args: any[]) => mockBrowserLogin(...args),
}))

const mockLoadGlobal = vi.fn().mockReturnValue({})
const mockSaveGlobal = vi.fn()
vi.mock(`@TSA/services/config`, () => ({
  ConfigService: {
    loadGlobal: (...args: any[]) => mockLoadGlobal(...args),
    saveGlobal: (...args: any[]) => mockSaveGlobal(...args),
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal(`fetch`, mockFetch)

describe(`ensureAuth`, () => {
  let originalIsTTY: boolean | undefined
  let exitCode: number | undefined

  const mockAction: TTaskAction = vi.fn()
  const makeAuth = (loggedIn: boolean, expired = false) => ({
    loggedIn: vi.fn().mockReturnValue(loggedIn),
    isExpired: vi.fn().mockReturnValue(expired),
    creds: vi.fn().mockReturnValue(
      loggedIn ? { token: `tok`, proxyUrl: `https://px.test`, expiresAt: `2099-01-01` } : null
    ),
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    bearer: loggedIn ? `tok` : null,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    exitCode = undefined
    originalIsTTY = process.stdin.isTTY
    vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
    vi.spyOn(process.stderr, `write`).mockImplementation(() => true)
    vi.spyOn(process, `exit`).mockImplementation((code?: any) => {
      exitCode = code ?? 0
      throw new Error(`__EXIT__`)
    })
  })

  afterEach(() => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    })
  })

  const makeArgs = (auth: any, config?: any): TTaskActionArgs => ({
    auth,
    config,
    params: {},
    task: { name: `test` },
    tasks: {},
  })

  it(`proceeds when logged in and not expired`, async () => {
    const auth = makeAuth(true, false)
    const wrapped = ensureAuth(mockAction)
    await wrapped(makeArgs(auth))
    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  it(`exits with error in non-TTY when not logged in`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, { value: false, writable: true, configurable: true })
    const auth = makeAuth(false)
    const wrapped = ensureAuth(mockAction)

    try { await wrapped(makeArgs(auth)) } catch {}
    expect(exitCode).toBe(1)
    expect(mockAction).not.toHaveBeenCalled()
  })

  it(`triggers browser login in TTY when not logged in`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, { value: true, writable: true, configurable: true })
    const auth = makeAuth(false)
    mockBrowserLogin.mockResolvedValue({ token: `new-tok`, expiresAt: `2099-01-01` })
    auth.loginWithToken.mockResolvedValue(undefined)
    // After loginWithToken, loggedIn should return true
    auth.loggedIn.mockReturnValueOnce(false).mockReturnValue(true)
    auth.isExpired.mockReturnValue(false)

    const wrapped = ensureAuth(mockAction)
    await wrapped(makeArgs(auth, {}))

    expect(mockBrowserLogin).toHaveBeenCalled()
    expect(auth.loginWithToken).toHaveBeenCalled()
    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  it(`exits when browser login fails`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, { value: true, writable: true, configurable: true })
    const auth = makeAuth(false)
    mockBrowserLogin.mockRejectedValue(new Error(`Timed out`))

    const wrapped = ensureAuth(mockAction)
    try { await wrapped(makeArgs(auth, {})) } catch {}
    expect(exitCode).toBe(1)
    expect(mockAction).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts src/utils/tasks/ensureAuth.test.ts`
Expected: FAIL — `ensureAuth` module not found.

- [ ] **Step 3: Implement `ensureAuth`**

Create `repos/tsa/src/utils/tasks/ensureAuth.ts`:

```typescript
import type { TTaskAction } from '@TSA/types'

import { themed } from '@TSA/theme'
import { isLocalUrl } from '@TSA/utils/api/isLocalUrl'
import { browserLogin } from '@TSA/services/browserAuth'
import { TokenRefreshService } from '@TSA/services/tokenRefresh'
import { resolveAuthUrl, resolveProxyUrl } from '@TSA/utils/tasks/resolveUrls'

export const ensureAuth =
  (action: TTaskAction): TTaskAction =>
  async (args) => {
    const { auth, config } = args

    if (auth.loggedIn() && !auth.isExpired()) return action(args)

    if (auth.loggedIn() && auth.isExpired()) {
      const refresher = new TokenRefreshService(auth)
      const refreshed = await refresher.maybeRefresh()
      if (refreshed && auth.loggedIn() && !auth.isExpired()) return action(args)
    }

    if (!process.stdin.isTTY) {
      process.stdout.write(
        `${themed(`error`, `Not logged in.`)} Run ${themed(`primary`, `tsa login`)} first.\n`
      )
      process.exit(1)
    }

    const authUrl = resolveAuthUrl(config)
    const proxyUrl = resolveProxyUrl(config)

    process.stdout.write(`${themed(`muted`, `Opening browser to log in...`)}\n`)

    try {
      const result = await browserLogin(authUrl)
      const insecure = isLocalUrl(proxyUrl)
      await auth.loginWithToken({ ...result, proxyUrl, insecure })

      if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = `0`

      process.stdout.write(`${themed(`success`, `Logged in successfully`)}\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Browser login failed`
      process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }

    return action(args)
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts src/utils/tasks/ensureAuth.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Delete `requireAuth.ts`**

Delete: `repos/tsa/src/utils/tasks/requireAuth.ts`

- [ ] **Step 6: Verify no remaining imports of `requireAuth`**

Run: `cd repos/tsa && grep -r "requireAuth" src/ --include="*.ts" -l`
Expected: Only test files or files that will be updated in subsequent tasks. Note the files — they will all be updated in Tasks 6-7.

---

### Task 3: Update `resolveOrgId` with config fallback + interactive picker

**Files:**
- Modify: `repos/tsa/src/utils/tasks/resolveOrgId.ts`
- Create: `repos/tsa/src/utils/tasks/resolveOrgId.test.ts`

- [ ] **Step 1: Write tests for updated `resolveOrgId`**

Create `repos/tsa/src/utils/tasks/resolveOrgId.test.ts`:

```typescript
import type { ApiClient } from '@TSA/services/api'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveOrgId } from './resolveOrgId'

const makeClient = (orgs: { id: string; name: string }[] | null, error?: any) =>
  ({
    listOrgs: vi.fn().mockResolvedValue({
      data: orgs,
      ok: !error && !!orgs,
      status: error ? 500 : 200,
      error: error ? { message: error } : undefined,
    }),
  }) as unknown as ApiClient

describe(`resolveOrgId`, () => {
  let originalIsTTY: boolean | undefined

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY
  })

  afterEach(() => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    })
  })

  it(`returns explicit orgId when provided`, async () => {
    const client = makeClient([{ id: `o1`, name: `Org1` }])
    const result = await resolveOrgId(client, `explicit-org`)
    expect(result).toBe(`explicit-org`)
    expect(client.listOrgs).not.toHaveBeenCalled()
  })

  it(`auto-selects when single org exists`, async () => {
    const client = makeClient([{ id: `o1`, name: `Only Org` }])
    const result = await resolveOrgId(client)
    expect(result).toBe(`o1`)
  })

  it(`returns config org when it matches an org in the list`, async () => {
    const client = makeClient([
      { id: `o1`, name: `Org A` },
      { id: `o2`, name: `Org B` },
    ])
    const result = await resolveOrgId(client, undefined, `o2`)
    expect(result).toBe(`o2`)
  })

  it(`ignores config org when it does not match any org`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, { value: false, writable: true, configurable: true })
    const client = makeClient([
      { id: `o1`, name: `Org A` },
      { id: `o2`, name: `Org B` },
    ])
    await expect(resolveOrgId(client, undefined, `o-stale`)).rejects.toThrow(
      `Multiple orgs found. Use --org <id> to specify.`
    )
  })

  it(`throws when no orgs found`, async () => {
    const client = makeClient([])
    await expect(resolveOrgId(client)).rejects.toThrow(`No organizations found`)
  })

  it(`throws when API returns error`, async () => {
    const client = makeClient(null, `Network error`)
    await expect(resolveOrgId(client)).rejects.toThrow(`Network error`)
  })

  it(`throws when multiple orgs and non-TTY`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, { value: false, writable: true, configurable: true })
    const client = makeClient([
      { id: `o1`, name: `A` },
      { id: `o2`, name: `B` },
    ])
    await expect(resolveOrgId(client)).rejects.toThrow(
      `Multiple orgs found. Use --org <id> to specify.`
    )
  })
})
```

- [ ] **Step 2: Run tests to see which pass/fail**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts src/utils/tasks/resolveOrgId.test.ts`
Expected: Some tests fail (config fallback test, since current implementation lacks `configOrgId` param).

- [ ] **Step 3: Implement updated `resolveOrgId`**

Replace the contents of `repos/tsa/src/utils/tasks/resolveOrgId.ts`:

```typescript
import type { ApiClient } from '@TSA/services/api'

import { createInterface } from 'readline'
import { themed } from '@TSA/theme'

const promptOrgSelection = async (
  orgs: { id: string; name: string }[]
): Promise<string> => {
  process.stdout.write(`\n${themed(`primary`, `Select an organization:`)}\n`)
  orgs.forEach((o, i) => {
    process.stdout.write(
      `  ${themed(`muted`, `${i + 1}.`)} ${o.name} ${themed(`muted`, `(${o.id})`)}\n`
    )
  })

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve, reject) => {
    rl.question(`${themed(`muted`, `Enter number:`)} `, (answer) => {
      rl.close()
      const idx = Number.parseInt(answer, 10) - 1
      if (idx >= 0 && idx < orgs.length) resolve(orgs[idx].id)
      else reject(new Error(`Invalid selection`))
    })
  })
}

export const resolveOrgId = async (
  client: ApiClient,
  explicitOrgId?: string,
  configOrgId?: string
): Promise<string> => {
  if (explicitOrgId) return explicitOrgId

  const { data: orgs, error } = await client.listOrgs()
  if (error || !orgs) throw new Error(error?.message || `Failed to list organizations`)

  if (orgs.length === 0) throw new Error(`No organizations found`)

  if (orgs.length === 1) return orgs[0].id

  if (configOrgId && orgs.some((o) => o.id === configOrgId)) return configOrgId

  if (process.stdin.isTTY) return promptOrgSelection(orgs)

  throw new Error(`Multiple orgs found. Use --org <id> to specify.`)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts src/utils/tasks/resolveOrgId.test.ts`
Expected: All 7 tests PASS.

---

### Task 4: Create `resolveSandboxId` with alias resolution + interactive picker

**Files:**
- Create: `repos/tsa/src/utils/tasks/resolveSandboxId.ts`
- Create: `repos/tsa/src/utils/tasks/resolveSandboxId.test.ts`

- [ ] **Step 1: Write tests for `resolveSandboxId`**

Create `repos/tsa/src/utils/tasks/resolveSandboxId.test.ts`:

```typescript
import type { ApiClient } from '@TSA/services/api'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveSandboxId } from './resolveSandboxId'

const makeSandbox = (
  id: string,
  name: string,
  alias?: string,
  projectId = `proj1`,
  runtimeCommand?: string
) => ({
  id,
  name,
  config: { runtimeCommand },
  projectConfigs: alias ? [{ projectId, alias }] : [],
})

const makeClient = (sandboxes: any[] | null, error?: any) =>
  ({
    listSandboxes: vi.fn().mockResolvedValue({
      data: sandboxes,
      ok: !error && !!sandboxes,
      status: error ? 500 : 200,
      error: error ? { message: error } : undefined,
    }),
  }) as unknown as ApiClient

describe(`resolveSandboxId`, () => {
  let originalIsTTY: boolean | undefined

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY
    vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
  })

  afterEach(() => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it(`returns explicit sandbox by ID match`, async () => {
    const client = makeClient([makeSandbox(`sb_1`, `Claude Code`, `cc`)])
    const result = await resolveSandboxId(client, `org1`, `proj1`, `sb_1`)
    expect(result).toBe(`sb_1`)
  })

  it(`resolves alias to sandbox ID for the active project`, async () => {
    const client = makeClient([
      makeSandbox(`sb_1`, `Claude Code`, `cc`, `proj1`),
      makeSandbox(`sb_2`, `Codex`, `codex`, `proj1`),
    ])
    const result = await resolveSandboxId(client, `org1`, `proj1`, `cc`)
    expect(result).toBe(`sb_1`)
  })

  it(`does not resolve alias from a different project`, async () => {
    const client = makeClient([
      makeSandbox(`sb_1`, `Claude Code`, `cc`, `proj-other`),
    ])
    await expect(
      resolveSandboxId(client, `org1`, `proj1`, `cc`)
    ).rejects.toThrow(`Sandbox not found: cc`)
  })

  it(`throws when explicit value matches nothing`, async () => {
    const client = makeClient([makeSandbox(`sb_1`, `Claude Code`)])
    await expect(
      resolveSandboxId(client, `org1`, `proj1`, `nonexistent`)
    ).rejects.toThrow(`Sandbox not found: nonexistent`)
  })

  it(`auto-selects when single sandbox exists`, async () => {
    const client = makeClient([makeSandbox(`sb_1`, `Claude Code`)])
    const result = await resolveSandboxId(client, `org1`, `proj1`)
    expect(result).toBe(`sb_1`)
  })

  it(`returns config sandbox when it matches`, async () => {
    const client = makeClient([
      makeSandbox(`sb_1`, `Claude Code`),
      makeSandbox(`sb_2`, `Codex`),
    ])
    const result = await resolveSandboxId(client, `org1`, `proj1`, undefined, `sb_2`)
    expect(result).toBe(`sb_2`)
  })

  it(`ignores stale config sandbox`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, { value: false, writable: true, configurable: true })
    const client = makeClient([
      makeSandbox(`sb_1`, `Claude Code`),
      makeSandbox(`sb_2`, `Codex`),
    ])
    await expect(
      resolveSandboxId(client, `org1`, `proj1`, undefined, `sb_gone`)
    ).rejects.toThrow(`Multiple sandboxes found. Use --sandbox <id> to specify.`)
  })

  it(`throws when no sandboxes found`, async () => {
    const client = makeClient([])
    await expect(
      resolveSandboxId(client, `org1`, `proj1`)
    ).rejects.toThrow(`No sandboxes found in this project`)
  })

  it(`throws when multiple sandboxes and non-TTY`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, { value: false, writable: true, configurable: true })
    const client = makeClient([
      makeSandbox(`sb_1`, `A`),
      makeSandbox(`sb_2`, `B`),
    ])
    await expect(
      resolveSandboxId(client, `org1`, `proj1`)
    ).rejects.toThrow(`Multiple sandboxes found. Use --sandbox <id> to specify.`)
  })

  it(`throws when API returns error`, async () => {
    const client = makeClient(null, `Server error`)
    await expect(
      resolveSandboxId(client, `org1`, `proj1`)
    ).rejects.toThrow(`Server error`)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts src/utils/tasks/resolveSandboxId.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `resolveSandboxId`**

Create `repos/tsa/src/utils/tasks/resolveSandboxId.ts`:

```typescript
import type { ApiClient } from '@TSA/services/api'

import { createInterface } from 'readline'
import { themed } from '@TSA/theme'

const getAlias = (sandbox: any, projectId: string): string =>
  sandbox.projectConfigs?.find((pc: any) => pc.projectId === projectId)?.alias || ``

const promptSandboxSelection = async (
  sandboxes: any[],
  projectId: string
): Promise<string> => {
  const nameW = 20
  const aliasW = 20
  const runtimeW = 16

  process.stdout.write(`\n${themed(`primary`, `Select a sandbox:`)}\n`)
  sandboxes.forEach((sb, i) => {
    const name = (sb.name || `unnamed`).slice(0, nameW).padEnd(nameW)
    const alias = (getAlias(sb, projectId) || `-`).slice(0, aliasW).padEnd(aliasW)
    const runtime = (sb.config?.runtimeCommand || `-`).slice(0, runtimeW).padEnd(runtimeW)
    process.stdout.write(
      `  ${themed(`muted`, `${i + 1}.`)} ${name} ${themed(`success`, alias)} ${themed(`muted`, runtime)} ${themed(`muted`, sb.id)}\n`
    )
  })

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve, reject) => {
    rl.question(`${themed(`muted`, `Enter number:`)} `, (answer) => {
      rl.close()
      const idx = Number.parseInt(answer, 10) - 1
      if (idx >= 0 && idx < sandboxes.length) resolve(sandboxes[idx].id)
      else reject(new Error(`Invalid selection`))
    })
  })
}

export const resolveSandboxId = async (
  client: ApiClient,
  orgId: string,
  projectId: string,
  explicitSandboxId?: string,
  configSandboxId?: string
): Promise<string> => {
  const { data: sandboxes, error } = await client.listSandboxes(orgId, projectId)
  if (error || !sandboxes)
    throw new Error(error?.message || `Failed to list sandboxes`)

  if (explicitSandboxId) {
    const byId = sandboxes.find((sb: any) => sb.id === explicitSandboxId)
    if (byId) return byId.id

    const byAlias = sandboxes.find(
      (sb: any) => getAlias(sb, projectId) === explicitSandboxId
    )
    if (byAlias) return byAlias.id

    throw new Error(`Sandbox not found: ${explicitSandboxId}`)
  }

  if (sandboxes.length === 0)
    throw new Error(`No sandboxes found in this project`)

  if (sandboxes.length === 1) {
    process.stdout.write(
      `${themed(`muted`, `Using sandbox:`)} ${sandboxes[0].name || sandboxes[0].id}\n`
    )
    return sandboxes[0].id
  }

  if (configSandboxId && sandboxes.some((sb: any) => sb.id === configSandboxId))
    return configSandboxId

  if (process.stdin.isTTY) return promptSandboxSelection(sandboxes, projectId)

  throw new Error(`Multiple sandboxes found. Use --sandbox <id> to specify.`)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/tsa && npx vitest run --config configs/vitest.config.ts src/utils/tasks/resolveSandboxId.test.ts`
Expected: All 10 tests PASS.

---

### Task 5: Update `saveContext` with sandbox persistence + cascade clears

**Files:**
- Modify: `repos/tsa/src/utils/tasks/saveContext.ts`

- [ ] **Step 1: Update `saveContext` to accept and persist `sandboxId`**

Replace the contents of `repos/tsa/src/utils/tasks/saveContext.ts`:

```typescript
import type { TTsaConfig } from '@TSA/types'

import { ConfigService } from '@TSA/services/config'

export const saveContext = (
  config: TTsaConfig,
  orgId: string,
  projectId: string,
  sandboxId?: string
): void => {
  const updates: Partial<TTsaConfig> = {}

  if (orgId !== config.org) {
    updates.org = orgId
    updates.project = projectId
    updates.sandboxId = sandboxId
  } else if (projectId !== config.project) {
    updates.project = projectId
    updates.sandboxId = sandboxId
  } else if (sandboxId && sandboxId !== config.sandboxId) {
    updates.sandboxId = sandboxId
  }

  if (Object.keys(updates).length === 0) return

  try {
    ConfigService.saveGlobal({ ...config, ...updates })
  } catch (err) {
    process.stderr.write(`Warning: failed to save config: ${(err as Error).message}\n`)
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/tsa && pnpm types`
Expected: No errors.

---

### Task 6: Rename `run` → `sandbox`, delete `sandboxes`, update task index

**Files:**
- Rename: `repos/tsa/src/tasks/run.ts` → `repos/tsa/src/tasks/sandbox.ts`
- Delete: `repos/tsa/src/tasks/sandboxes.ts`
- Modify: `repos/tsa/src/tasks/index.ts`

- [ ] **Step 1: Create `sandbox.ts` from `run.ts` with all updates**

Create `repos/tsa/src/tasks/sandbox.ts` (this replaces `run.ts`):

```typescript
import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { spawnSsh } from '@TSA/utils/tasks/spawnSsh'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { sandboxConnect } from '@TSA/utils/tasks/sandboxConnect'
import { resolveProjectId } from '@TSA/utils/tasks/resolveProjectId'
import { resolveSandboxId } from '@TSA/utils/tasks/resolveSandboxId'
import { autoStartSync, createSyncContext, stopSync } from '@TSA/utils/tasks/sandboxSync'
import {
  clearSyncCleanup,
  registerSyncCleanup,
} from '@TSA/utils/tasks/syncCleanupRegistry'

const getAlias = (sandbox: any, projectId: string): string =>
  sandbox.projectConfigs?.find((pc: any) => pc.projectId === projectId)?.alias || ``

export const sandbox: TTask = {
  name: `sandbox`,
  alias: [`sb`, `run`],
  description: `Start a sandbox, sync files, and launch its configured AI tool`,
  example: `tsa sandbox [<sandbox>] [--org <id>] [--project <id>] [--no-sync]`,
  options: {
    sandbox: {
      example: `--sb sb_xxx`,
      description: `Sandbox ID or alias`,
      alias: [`sandboxId`, `sb`],
    },
    org: {
      example: `--org org_xxx`,
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`],
    },
    project: {
      example: `--project proj_xxx`,
      description: `Project ID`,
      alias: [`projectId`, `p`],
    },
    noSync: {
      example: `--no-sync`,
      description: `Disable automatic file sync`,
      alias: [`nosync`],
      type: `bool`,
    },
    list: {
      example: `--list`,
      description: `List available sandboxes and exit`,
      alias: [`ls`],
      type: `bool`,
    },
  },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const explicitSandbox = params.sandbox || options?.[0]
    const client = new ApiClient(auth)

    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined, config?.org)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    const explicitProject =
      orgId !== config?.org ? undefined : (params.project as string | undefined)

    let projectId: string
    try {
      projectId = await resolveProjectId(client, orgId, explicitProject)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    if (params.list) {
      const { data: list, error } = await client.listSandboxes(orgId, projectId)
      if (error || !list) {
        const msg = error?.message || `Failed to list sandboxes`
        process.stderr.write(`${themed(`error`, `Error:`)} ${msg}\n`)
        process.exit(1)
      }

      if (!list.length) {
        process.stdout.write(`${themed(`muted`, `No sandboxes found`)}\n`)
        return
      }

      process.stdout.write(`\n${themed(`bold`, `Sandboxes:`)}\n`)
      const nameW = 20
      const aliasW = 22
      const runtimeW = 20
      process.stdout.write(
        `  ${'Name'.padEnd(nameW)} ${'Alias'.padEnd(aliasW)} ${'Runtime'.padEnd(runtimeW)} ID\n`
      )
      process.stdout.write(
        `  ${`─`.repeat(nameW)} ${`─`.repeat(aliasW)} ${`─`.repeat(runtimeW)} ${'─'.repeat(12)}\n`
      )
      for (const sb of list) {
        const name = (sb.name || `unnamed`).slice(0, nameW).padEnd(nameW)
        const alias = (getAlias(sb, projectId) || `-`)
          .slice(0, aliasW)
          .padEnd(aliasW)
        const runtime = (sb.config?.runtimeCommand || `-`)
          .slice(0, runtimeW)
          .padEnd(runtimeW)
        process.stdout.write(
          `  ${name} ${themed(`success`, alias)} ${themed(`muted`, runtime)} ${themed(`muted`, sb.id)}\n`
        )
      }
      process.stdout.write(`\n`)

      if (config) saveContext(config, orgId, projectId)
      return
    }

    let sandboxId: string
    try {
      sandboxId = await resolveSandboxId(
        client,
        orgId,
        projectId,
        explicitSandbox as string | undefined,
        config?.sandboxId
      )
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    if (config) saveContext(config, orgId, projectId, sandboxId)

    const { data: sbData, error: sandboxError } = await client.getSandbox(
      orgId,
      sandboxId,
      projectId
    )
    if (sandboxError || !sbData) {
      process.stderr.write(
        `${themed(`error`, `Error:`)} Could not fetch sandbox config: ${sandboxError?.message || `sandbox not found`}\n` +
          `${themed(`muted`, `Cannot determine runtime command. Use "tsa ssh" for a plain shell.`)}\n`
      )
      process.exit(1)
    }

    const runtimeCommand = sbData.config?.runtimeCommand as string | undefined

    let resolvedId: string
    try {
      const connectResp = await sandboxConnect(client, orgId, projectId, sandboxId)
      if (!connectResp.sandboxId)
        throw new Error(`Server did not return a resolved sandbox ID`)
      resolvedId = connectResp.sandboxId
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    const skipSync = params.noSync as boolean | undefined
    const syncCtx = createSyncContext()
    if (!skipSync) {
      try {
        await autoStartSync(syncCtx, config?.sync, client, orgId, resolvedId)
        if (syncCtx.started) registerSyncCleanup(resolvedId, syncCtx.manager)
      } catch (err) {
        process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
        await stopSync(syncCtx, resolvedId)
        process.exit(1)
      }
    }

    if (runtimeCommand) {
      process.stdout.write(`${themed(`muted`, `Launching "${runtimeCommand}"...`)}\n`)
    }

    try {
      await spawnSsh(resolvedId, runtimeCommand)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exitCode = 1
    } finally {
      clearSyncCleanup()
      await stopSync(syncCtx, resolvedId)
    }
  }),
}
```

- [ ] **Step 2: Delete old files**

Delete `repos/tsa/src/tasks/run.ts`.
Delete `repos/tsa/src/tasks/sandboxes.ts`.

- [ ] **Step 3: Update task index**

Replace the contents of `repos/tsa/src/tasks/index.ts`:

```typescript
import type { TTasks } from '@TSA/types'

import { ssh } from './ssh'
import { sync } from './sync'
import { chat } from './chat'
import { help } from './help'
import { login } from './login'
import { proxy } from './proxy'
import { logout } from './logout'
import { status } from './status'
import { agents } from './agents'
import { sandbox } from './sandbox'
import { threads } from './threads'
import { sessions } from './sessions'

export const tasks: TTasks = {
  ssh,
  sync,
  chat,
  help,
  login,
  proxy,
  logout,
  status,
  agents,
  sandbox,
  threads,
  sessions,
}
```

- [ ] **Step 4: Verify types compile**

Run: `cd repos/tsa && pnpm types`
Expected: Errors in files still importing `requireAuth` — these are fixed in Task 7.

---

### Task 7: Update remaining tasks to use `ensureAuth` and `resolveOrgId` with config

**Files:**
- Modify: `repos/tsa/src/tasks/ssh.ts`
- Modify: `repos/tsa/src/tasks/agents.ts`
- Modify: `repos/tsa/src/tasks/threads.ts`
- Modify: `repos/tsa/src/tasks/sync.ts`
- Modify: `repos/tsa/src/tasks/sessions.ts`

- [ ] **Step 1: Update `ssh.ts`**

In `repos/tsa/src/tasks/ssh.ts`:

Replace import:
```typescript
// Before
import { requireAuth } from '@TSA/utils/tasks/requireAuth'
// After
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
```

Replace `requireAuth(` with `ensureAuth(` (2 instances won't exist here — just the main action wrapper on the line `action: requireAuth(async ({`).

Update `resolveOrgId` call to pass config fallback:
```typescript
// Before
orgId = await resolveOrgId(client, params.org as string | undefined)
// After
orgId = await resolveOrgId(client, params.org as string | undefined, config?.org)
```

- [ ] **Step 2: Update `agents.ts`**

Replace the entire contents of `repos/tsa/src/tasks/agents.ts`:

```typescript
import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'

export const agents: TTask = {
  name: `agents`,
  alias: [`agent`, `ag`],
  description: `List available agents`,
  example: `tsa agents [--org <id>]`,
  options: {
    org: {
      type: `str`,
      example: `--org org_xxx`,
      description: `Organization ID`,
    },
  },
  action: ensureAuth(async ({ params, auth, config }) => {
    const client = new ApiClient(auth)

    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined, config?.org)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    const { data: agentList, error } = await client.listAgents(orgId)
    if (error || !agentList) {
      const msg = error?.message || `Failed to list agents`
      process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }

    if (!agentList.length) {
      process.stdout.write(`${themed(`muted`, `No agents found`)}\n`)
      return
    }

    process.stdout.write(`\n${themed(`bold`, `Agents:`)}\n`)
    for (const agent of agentList) {
      const model = agent.model ? themed(`muted`, ` (${agent.model})`) : ``
      process.stdout.write(`  ${themed(`muted`, agent.id)} ${agent.name}${model}\n`)
    }
    process.stdout.write(`\n`)
  }),
}
```

- [ ] **Step 3: Update `threads.ts`**

Replace the entire contents of `repos/tsa/src/tasks/threads.ts`:

```typescript
import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'

export const threads: TTask = {
  name: `threads`,
  alias: [`th`],
  description: `List threads for an agent`,
  example: `tsa threads <agent-id> [--org <id>]`,
  options: {
    agent: {
      alias: [`agentId`],
      example: `--agentId agent_xxx`,
      description: `Agent ID to list threads for`,
    },
    org: {
      example: `--org org_xxx`,
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`],
    },
  },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const agentId = params.agent || options?.[0]
    if (!agentId) {
      process.stdout.write(
        `${themed(`warning`, `Usage: tsa threads <agent-id> [--org <id>]`)}\n`
      )
      process.exit(1)
    }

    const client = new ApiClient(auth)

    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined, config?.org)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    const { data: threadList, error: threadsError } = await client.listThreads(
      orgId,
      agentId
    )
    if (threadsError || !threadList) {
      const msg = threadsError?.message || `Failed to list threads`
      process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }

    if (!threadList.length) {
      process.stdout.write(`${themed(`muted`, `No threads found`)}\n`)
      return
    }

    process.stdout.write(`\n${themed(`bold`, `Threads:`)}\n`)
    for (const t of threadList) {
      const name = t.name || themed(`muted`, `untitled`)
      process.stdout.write(`  ${themed(`muted`, t.id)} ${name}\n`)
    }
    process.stdout.write(`\n`)
  }),
}
```

- [ ] **Step 4: Update `sync.ts`**

In `repos/tsa/src/tasks/sync.ts`:

Replace the import:
```typescript
// Before
import { requireAuth } from '@TSA/utils/tasks/requireAuth'
// After
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
```

Replace all 5 occurrences of `requireAuth(` with `ensureAuth(`:
- Line 33: `stopTask.action`
- Line 70: `statusTask.action`
- Line 109: `flushTask.action`
- Line 124: `cleanupTask.action`
- Line 223: main `sync.action`

In the main `sync.action`, replace the inline org resolution (lines 236-250) with `resolveOrgId`:

```typescript
// Before (lines 236-250)
    let orgId = params.org as string | undefined
    if (!orgId) {
      const { data: orgs, error } = await client.listOrgs()
      if (error || !orgs) {
        const msg = error?.message || `Failed to list organizations`
        process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
        process.exit(1)
      }
      if (orgs.length === 1) orgId = orgs[0].id
      else {
        process.stdout.write(
          `${themed(`error`, `Multiple orgs found. Use --org to specify.`)}\n`
        )
        process.exit(1)
      }
    }

// After
    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined, config?.org)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }
```

Add the `resolveOrgId` import:
```typescript
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
```

- [ ] **Step 5: Update `sessions.ts`**

In `repos/tsa/src/tasks/sessions.ts`:

Replace import:
```typescript
// Before
import { requireAuth } from '@TSA/utils/tasks/requireAuth'
// After
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
```

Replace all 3 occurrences of `requireAuth(` with `ensureAuth(`:
- Line 147: `share` subtask action
- Line 203: `unshare` subtask action
- Line 244: main `sessions` action

Update all 3 `resolveOrgId` calls to pass config fallback. Each one follows the same pattern — add `config?.org` as the third argument:

```typescript
// Before
orgId = await resolveOrgId(client, params.org as string | undefined)
// After
orgId = await resolveOrgId(client, params.org as string | undefined, config?.org)
```

Note: The `share` and `unshare` subtask action signatures need `config` added to their destructured params since they currently destructure `{ params, auth, config, options }` — verify `config` is already present (it is, since `TTaskActionArgs` includes it).

- [ ] **Step 6: Verify types compile**

Run: `cd repos/tsa && pnpm types`
Expected: No type errors.

---

### Task 8: Update `cli.ts` default command + update tests

**Files:**
- Modify: `repos/tsa/src/cli.ts`
- Modify: `repos/tsa/src/cli.test.ts`

- [ ] **Step 1: Change default command in `cli.ts`**

In `repos/tsa/src/cli.ts`, line 20, change `chat` to `sandbox`:

```typescript
// Before
    ? [`chat`, ...argv]
// After
    ? [`sandbox`, ...argv]
```

- [ ] **Step 2: Update `cli.test.ts`**

The test file has tests that verify the default command behavior and agent-related tests that check for `requireAuth` behavior ("Not logged in" messages). These need updating:

In the `agents command` describe block, the test `should require auth` (line 262-266) currently expects `"Not logged in"` text output. With `ensureAuth`, the behavior in non-TTY is the same message. But in TTY, it would try browser login. The test mocks `process.exit` and doesn't set TTY, so it should still work as-is for the non-TTY path. However, `ensureAuth` now also imports `browserLogin` which needs to be mocked.

The `browserLogin` mock already exists at the top of the test file (line 22-24). No additional mocking needed.

Update the `default command` describe block:

```typescript
// Before
  describe(`default command`, () => {
    it(`should default to chat when first arg is a value flag`, async () => {
      setArgv(`--org`, `org1`)
      setLoggedIn()
      await runMain()

      expect(mockPiTuiStart).toHaveBeenCalledTimes(1)
      expect(mockChatLogicInit).toHaveBeenCalledTimes(1)
    })
  })

// After
  describe(`default command`, () => {
    it(`should default to sandbox when first arg is a value flag`, async () => {
      setArgv(`--org`, `org1`)
      setLoggedIn()
      // sandbox task without sandbox ID will try to list/pick — mock the fetch
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ id: `org1`, name: `TestOrg` }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ id: `proj1`, name: `TestProject` }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })

      await runMain()

      // sandbox task with no sandboxes prints "No sandboxes found"
      expect(joined()).toContain(`No sandboxes found`)
    })
  })
```

Update the `chat command` test at line 471-478 (`should start pi-tui chat for default (empty) command when not logged in`):

```typescript
// Before
    it(`should start pi-tui chat for default (empty) command when not logged in`, async () => {
      setArgv()
      setLoggedOut()
      await runMain()

      expect(mockPiTuiStart).toHaveBeenCalledTimes(1)
      expect(mockChatLogicInit).toHaveBeenCalledTimes(1)
    })

// After — default is now sandbox, not chat. This test should verify sandbox behavior.
    it(`should default to sandbox (not chat) when no args`, async () => {
      setArgv()
      setLoggedOut()
      // ensureAuth in non-TTY exits with "Not logged in"
      await runMain()

      expect(joined()).toContain(`Not logged in`)
      expect(exitCode).toBe(1)
    })
```

Update the `agents command` test `should list orgs when multiple exist` (lines 296-315). Currently it expects `"Organizations:"` and `"--org"` text output from agents' inline org resolution. After the refactor, `resolveOrgId` will throw (non-TTY) or prompt (TTY). Since tests mock `process.stdin.isTTY` as undefined (non-TTY default), it will now throw → exit with error:

```typescript
// Before
    it(`should list orgs when multiple exist`, async () => {
      setArgv(`agents`)
      setLoggedIn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: `org1`, name: `Org A` },
            { id: `org2`, name: `Org B` },
          ],
        }),
      })

      await runMain()

      expect(joined()).toContain(`Organizations:`)
      expect(joined()).toContain(`Org A`)
      expect(joined()).toContain(`Org B`)
      expect(joined()).toContain(`--org`)
    })

// After
    it(`should error when multiple orgs and no --org flag`, async () => {
      setArgv(`agents`)
      setLoggedIn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: `org1`, name: `Org A` },
            { id: `org2`, name: `Org B` },
          ],
        }),
      })

      await runMain()

      expect(joined()).toContain(`Multiple orgs found`)
      expect(exitCode).toBe(1)
    })
```

Update the `threads command` test `should warn when multiple orgs` similarly — the error message stays the same, but it now comes from `resolveOrgId` throwing rather than inline code. The test assertions should still pass as-is since the error message is identical. Verify by running.

Update the help test `should list all available commands` (line 132-144). Replace the check for `run` and `sandboxes` with `sandbox`:

```typescript
// Before (within the test)
      // implicit: text should contain "run" and "sandboxes" from task examples
// After — verify sandbox is listed
      expect(text).toContain(`sandbox`)
```

- [ ] **Step 3: Run all TSA tests**

Run: `cd repos/tsa && pnpm test`
Expected: All tests PASS.

- [ ] **Step 4: Fix any failing tests**

If any tests fail due to the `ensureAuth` import chain (e.g., `browserLogin` mock not being picked up), add or verify the `browserLogin` mock in the affected test file. The `cli.test.ts` already mocks it at line 22-24.

---

### Task 9: Build + type check + full verification

**Files:** None (verification only)

- [ ] **Step 1: Run type check**

Run: `cd repos/tsa && pnpm types`
Expected: No type errors.

- [ ] **Step 2: Run full test suite**

Run: `cd repos/tsa && pnpm test`
Expected: All tests PASS.

- [ ] **Step 3: Verify build**

Run: `cd repos/tsa && pnpm build`
Expected: Build completes without errors.

- [ ] **Step 4: Verify no stale imports**

Run: `cd repos/tsa && grep -r "requireAuth\|from.*sandboxes\|from.*\/run" src/ --include="*.ts" | grep -v test | grep -v node_modules`
Expected: No matches (all old imports removed).

- [ ] **Step 5: Verify `sandbox` task is registered with aliases**

Run: `cd repos/tsa && grep -A2 "alias.*run\|alias.*sb" src/tasks/sandbox.ts`
Expected: Shows `alias: ['sb', 'run']`.
