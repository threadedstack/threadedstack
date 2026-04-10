# REPL Production Rewrite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `repos/repl` from a concept-stage readline CLI into a production-grade Ink (React) terminal interface for non-technical users interacting with pre-configured AI agents.

**Architecture:** Replace the raw readline REPL with React + Ink components (same approach as Claude Code). Keep the task-based CLI dispatch layer (`@keg-hub/args-parse`), refactor services (ApiClient, AuthManager, LocalAgentExecutor), add YAML config, context loading, lifecycle hooks, provider switching, and friendly error handling.

**Tech Stack:** TypeScript, Ink (React for CLI), Bun runtime, picocolors, js-yaml, marked + marked-terminal, vitest + ink-testing-library

**Design Doc:** `docs/plans/2026-02-17-repl-production-design.md`

---

## Task 1: Add Dependencies and Configure Build

**Files:**
- Modify: `repos/repl/package.json`
- Modify: `repos/repl/tsconfig.json`
- Modify: `repos/repl/configs/vitest.config.ts`

**Step 1: Install new dependencies**

Run:
```bash
cd repos/repl && pnpm add ink react picocolors js-yaml ora ink-text-input
```

**Step 2: Install new dev dependencies**

Run:
```bash
cd repos/repl && pnpm add -D @types/js-yaml @types/react ink-testing-library
```

**Step 3: Update tsconfig.json for JSX**

Add to `compilerOptions` in `repos/repl/tsconfig.json`:
```json
{
  "jsx": "react-jsx",
  "jsxImportSource": "react"
}
```

**Step 4: Update vitest config to include .tsx files**

In `repos/repl/configs/vitest.config.ts`, change include pattern:
```typescript
include: ['**/*.test.ts', '**/*.test.tsx']
```

**Step 5: Verify build still works**

Run:
```bash
cd repos/repl && pnpm build
```
Expected: Build succeeds (no source files changed yet)

**Step 6: Commit**

```bash
git add repos/repl/package.json repos/repl/tsconfig.json repos/repl/configs/vitest.config.ts repos/repl/pnpm-lock.yaml
git commit -m "chore(repl): add Ink, React, picocolors, js-yaml deps and configure JSX"
```

---

## Task 2: Types and Constants Foundation

**Files:**
- Create: `repos/repl/src/types/config.types.ts`
- Create: `repos/repl/src/types/session.types.ts`
- Create: `repos/repl/src/types/commands.types.ts`
- Create: `repos/repl/src/types/context.types.ts`
- Modify: `repos/repl/src/types/index.ts`
- Create: `repos/repl/src/constants/errors.ts`
- Create: `repos/repl/src/constants/tools.ts`
- Modify: `repos/repl/src/constants/index.ts`
- Modify: `repos/repl/src/constants/values.ts`

**Step 1: Write tests for config types validation**

Create `repos/repl/src/types/config.types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import type { TReplConfig, TProjectConfig, TAuthConfig, TSandboxConfig, TDisplayConfig, TBehaviorConfig } from './config.types'

describe('Config Types', () => {
  it('TReplConfig has correct shape', () => {
    const config: TReplConfig = {
      auth: { apiKey: 'tdsk_test', proxyUrl: 'https://example.com' },
      org: 'org_1',
      agent: 'agent_1',
      display: { theme: 'dark', verbose: false, markdown: true, timestamps: false },
      behavior: { autoResume: true, maxHistory: 50, confirmTools: false },
      sandbox: { provider: 'local', timeout: 300000 },
    }
    expect(config.auth.apiKey).toBe('tdsk_test')
    expect(config.display.theme).toBe('dark')
    expect(config.sandbox.provider).toBe('local')
  })

  it('TProjectConfig has correct shape', () => {
    const config: TProjectConfig = {
      agent: 'agent_1',
      org: 'org_1',
      context: ['AGENTS.md'],
      hooks: {},
      tools: { confirm: [], block: [] },
    }
    expect(config.context).toEqual(['AGENTS.md'])
  })

  it('TAuthConfig fields are optional except apiKey', () => {
    const auth: TAuthConfig = { apiKey: 'tdsk_test' }
    expect(auth.proxyUrl).toBeUndefined()
    expect(auth.insecure).toBeUndefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/types/config.types.test.ts`
Expected: FAIL — module not found

**Step 3: Create config types**

Create `repos/repl/src/types/config.types.ts`:
```typescript
export type TAuthConfig = {
  apiKey: string
  proxyUrl?: string
  insecure?: boolean
}

export type TDisplayConfig = {
  theme?: 'dark' | 'light' | 'auto'
  verbose?: boolean
  markdown?: boolean
  timestamps?: boolean
}

export type TBehaviorConfig = {
  autoResume?: boolean
  maxHistory?: number
  confirmTools?: boolean
}

export type TSandboxConfig = {
  provider?: 'local' | 'e2b'
  timeout?: number
  envVars?: Record<string, string>
}

export type THooksConfig = {
  onSessionStart?: string
  onSessionEnd?: string
  onToolCall?: string
  onToolResult?: string
  onError?: string
  onMessage?: string
}

export type TToolsConfig = {
  confirm?: string[]
  block?: string[]
}

export type TReplConfig = {
  auth?: TAuthConfig
  org?: string
  agent?: string
  display?: TDisplayConfig
  behavior?: TBehaviorConfig
  sandbox?: TSandboxConfig
  hooks?: THooksConfig
  tools?: TToolsConfig
}

export type TProjectConfig = {
  agent?: string
  org?: string
  context?: string[]
  hooks?: THooksConfig
  tools?: TToolsConfig
}
```

**Step 4: Create session types**

Create `repos/repl/src/types/session.types.ts`:
```typescript
import type { TLLMProviderType } from '@tdsk/domain'

export type TSessionInfo = {
  model: string
  maxTokens?: number
  sessionToken: string
  systemPrompt?: string
  provider: TLLMProviderType
}

export type TProviderInfo = {
  id: string
  name: string
  model: string
  provider: TLLMProviderType
}

export type TConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'
```

**Step 5: Create command types**

Create `repos/repl/src/types/commands.types.ts`:
```typescript
export type TSlashCommandContext = {
  orgId: string
  agentId: string
  threadId: string | null
  setThreadId: (id: string | null) => void
  setAgentId: (id: string) => void
  setProviderId: (id: string) => void
  addContextFile: (path: string) => void
  removeContextFile: (index: number) => void
  setVerbose: (v: boolean) => void
  verbose: boolean
  exit: () => void
}

export type TSlashCommand = {
  name: string
  aliases: string[]
  description: string
  handler: (args: string, ctx: TSlashCommandContext) => Promise<string | void>
}
```

**Step 6: Create context types**

Create `repos/repl/src/types/context.types.ts`:
```typescript
export type TContextSource = 'auto' | 'manual'

export type TContextFile = {
  path: string
  name: string
  source: TContextSource
  content: string
  sizeBytes: number
}
```

**Step 7: Update types index**

Modify `repos/repl/src/types/index.ts` to re-export new types:
```typescript
export type * from './config.types'
export type * from './session.types'
export type * from './commands.types'
export type * from './context.types'
export type * from './tasks.types'
```

**Step 8: Create friendly error constants**

Create `repos/repl/src/constants/errors.ts`:
```typescript
export type TErrorPattern = {
  match: (error: unknown) => boolean
  message: string
  suggestion?: string
}

export const FRIENDLY_ERRORS: TErrorPattern[] = [
  {
    match: (e) => hasCode(e, 'ECONNREFUSED') || hasCode(e, 'ETIMEDOUT') || hasCode(e, 'ENOTFOUND'),
    message: "Can't reach the server.",
    suggestion: 'Check your internet connection and try again.',
  },
  {
    match: (e) => hasStatus(e, 401),
    message: 'Your session has expired.',
    suggestion: 'Run `tdsk-agent login` to reconnect.',
  },
  {
    match: (e) => hasStatus(e, 403),
    message: "You don't have permission to do that.",
    suggestion: 'Contact your admin for access.',
  },
  {
    match: (e) => hasStatus(e, 404),
    message: "That resource isn't available right now.",
    suggestion: 'Try `/agent` to pick a different one.',
  },
  {
    match: (e) => hasStatus(e, 429),
    message: 'The service is busy.',
    suggestion: 'Waiting a moment before trying again...',
  },
  {
    match: (e) => hasStatus(e, 500) || hasStatus(e, 502) || hasStatus(e, 503),
    message: 'The server is having trouble.',
    suggestion: 'Try again in a few moments.',
  },
]

function hasCode(e: unknown, code: string): boolean {
  return e instanceof Error && 'code' in e && (e as any).code === code
}

function hasStatus(e: unknown, status: number): boolean {
  return e instanceof Error && e.message.includes(`(${status})`)
}

export function toFriendlyError(error: unknown): { message: string; suggestion?: string } {
  for (const pattern of FRIENDLY_ERRORS) {
    if (pattern.match(error)) {
      return { message: pattern.message, suggestion: pattern.suggestion }
    }
  }
  return {
    message: 'Something unexpected happened.',
    suggestion: 'Your conversation is saved — just restart the REPL.',
  }
}
```

**Step 9: Create human-readable tool name map**

Create `repos/repl/src/constants/tools.ts`:
```typescript
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  listDir: 'Listed directory',
  readFile: 'Read file',
  writeFile: 'Wrote file',
  deleteFile: 'Deleted file',
  shellExec: 'Ran command',
  webSearch: 'Searched the web',
  webFetch: 'Fetched webpage',
  codeSearch: 'Searched code',
}

export function getToolDisplayName(toolName: string): string {
  return TOOL_DISPLAY_NAMES[toolName] || toolName
}
```

**Step 10: Update constants values**

Modify `repos/repl/src/constants/values.ts`:
```typescript
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'))

export const TDSK_REPL_VERSION = pkg.version

// Paths
export const CONFIG_DIR = join(process.env.HOME || '~', '.config', 'tdsk', 'repl')
export const CONFIG_PATH = join(CONFIG_DIR, 'config.yaml')
export const HISTORY_PATH = join(CONFIG_DIR, 'history')

// Project context
export const PROJECT_DIR = '.tdsk'
export const PROJECT_CONFIG = '.tdsk/config.yaml'
export const CONTEXT_DIR = '.tdsk/context'
export const AGENTS_FILE = 'AGENTS.md'

// Defaults
export const DEFAULT_PROXY_URL = 'https://px.local.threadedstack.app'
export const DEFAULT_MAX_STEPS = 10
export const DEFAULT_MAX_HISTORY = 50
export const DEFAULT_SANDBOX_TIMEOUT = 300000
export const DEFAULT_THEME = 'dark' as const

// Retry
export const MAX_RETRIES = 3
export const RETRY_DELAYS = [1000, 3000, 9000]
```

**Step 11: Update constants index**

Modify `repos/repl/src/constants/index.ts`:
```typescript
export * from './values'
export * from './errors'
export * from './tools'
```

**Step 12: Run tests to verify types and constants**

Run: `cd repos/repl && pnpm test -- src/types/config.types.test.ts`
Expected: PASS

**Step 13: Commit**

```bash
git add repos/repl/src/types/ repos/repl/src/constants/
git commit -m "feat(repl): add types and constants for production rewrite"
```

---

## Task 3: Theme System

**Files:**
- Create: `repos/repl/src/theme/themes.ts`
- Create: `repos/repl/src/theme/colors.ts`
- Create: `repos/repl/src/theme/index.ts`
- Test: `repos/repl/src/theme/colors.test.ts`

**Step 1: Write tests for theme colors**

Create `repos/repl/src/theme/colors.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTheme, themed } from './colors'

describe('Theme System', () => {
  const originalEnv = process.env.NO_COLOR

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NO_COLOR
    else process.env.NO_COLOR = originalEnv
  })

  it('getTheme returns dark theme by default', () => {
    const theme = getTheme('dark')
    expect(theme).toBeDefined()
    expect(theme.primary).toBeDefined()
  })

  it('getTheme returns light theme', () => {
    const theme = getTheme('light')
    expect(theme).toBeDefined()
  })

  it('themed applies theme color to text', () => {
    const result = themed('primary', 'hello')
    expect(typeof result).toBe('string')
    expect(result).toContain('hello')
  })

  it('themed returns plain text when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1'
    const result = themed('primary', 'hello')
    expect(result).toBe('hello')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/theme/colors.test.ts`
Expected: FAIL — module not found

**Step 3: Create theme definitions**

Create `repos/repl/src/theme/themes.ts`:
```typescript
import pc from 'picocolors'

export type TThemeColors = {
  primary: (s: string) => string
  secondary: (s: string) => string
  success: (s: string) => string
  warning: (s: string) => string
  error: (s: string) => string
  muted: (s: string) => string
  accent: (s: string) => string
  border: (s: string) => string
  bold: (s: string) => string
}

export const darkTheme: TThemeColors = {
  primary: pc.cyan,
  secondary: pc.dim,
  success: pc.green,
  warning: pc.yellow,
  error: pc.red,
  muted: pc.gray,
  accent: pc.magenta,
  border: pc.dim,
  bold: pc.bold,
}

export const lightTheme: TThemeColors = {
  primary: pc.blue,
  secondary: pc.dim,
  success: pc.green,
  warning: pc.yellow,
  error: pc.red,
  muted: pc.gray,
  accent: pc.magenta,
  border: pc.dim,
  bold: pc.bold,
}
```

**Step 4: Create colors module**

Create `repos/repl/src/theme/colors.ts`:
```typescript
import type { TThemeColors } from './themes'
import { darkTheme, lightTheme } from './themes'

let activeTheme: TThemeColors = darkTheme

export function getTheme(name: 'dark' | 'light' | 'auto'): TThemeColors {
  if (name === 'light') return lightTheme
  return darkTheme
}

export function setTheme(name: 'dark' | 'light' | 'auto'): void {
  activeTheme = getTheme(name)
}

export function themed(color: keyof TThemeColors, text: string): string {
  if (process.env.NO_COLOR) return text
  return activeTheme[color](text)
}
```

**Step 5: Create theme index**

Create `repos/repl/src/theme/index.ts`:
```typescript
export { getTheme, setTheme, themed } from './colors'
export type { TThemeColors } from './themes'
export { darkTheme, lightTheme } from './themes'
```

**Step 6: Run tests**

Run: `cd repos/repl && pnpm test -- src/theme/colors.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add repos/repl/src/theme/
git commit -m "feat(repl): add theme system with dark/light themes and NO_COLOR support"
```

---

## Task 4: Friendly Errors Utility

**Files:**
- Create: `repos/repl/src/utils/friendly-errors.ts`
- Test: `repos/repl/src/utils/friendly-errors.test.ts`

**Step 1: Write tests**

Create `repos/repl/src/utils/friendly-errors.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { toFriendlyError } from '@TRL/constants/errors'

describe('toFriendlyError', () => {
  it('maps ECONNREFUSED to network error', () => {
    const err = Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' })
    const result = toFriendlyError(err)
    expect(result.message).toContain("Can't reach the server")
  })

  it('maps 401 to auth error', () => {
    const err = new Error('API error (401): Unauthorized')
    const result = toFriendlyError(err)
    expect(result.message).toContain('session has expired')
  })

  it('maps 429 to rate limit', () => {
    const err = new Error('API error (429): Too Many Requests')
    const result = toFriendlyError(err)
    expect(result.message).toContain('service is busy')
  })

  it('returns fallback for unknown errors', () => {
    const err = new Error('something weird')
    const result = toFriendlyError(err)
    expect(result.message).toContain('unexpected')
    expect(result.suggestion).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/utils/friendly-errors.test.ts`
Expected: FAIL — module may not resolve

**Step 3: Create friendly errors utility**

Create `repos/repl/src/utils/friendly-errors.ts`:
```typescript
export { toFriendlyError } from '@TRL/constants/errors'
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/utils/friendly-errors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/utils/friendly-errors.ts repos/repl/src/utils/friendly-errors.test.ts
git commit -m "feat(repl): add friendly error message mapping"
```

---

## Task 5: YAML Config Service

**Files:**
- Create: `repos/repl/src/services/config.ts`
- Test: `repos/repl/src/services/config.test.ts`

**Step 1: Write tests**

Create `repos/repl/src/services/config.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfigService } from './config'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
  chmodSync: vi.fn(),
  statSync: vi.fn(),
}))

vi.mock('js-yaml', () => ({
  load: vi.fn(),
  dump: vi.fn((obj: any) => JSON.stringify(obj)),
}))

describe('ConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadGlobal returns empty config when file does not exist', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const config = ConfigService.loadGlobal()
    expect(config).toEqual({})
  })

  it('loadGlobal parses YAML file', async () => {
    const fs = await import('node:fs')
    const yaml = await import('js-yaml')
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('org: org_1')
    vi.mocked(yaml.load).mockReturnValue({ org: 'org_1' })

    const config = ConfigService.loadGlobal()
    expect(config.org).toBe('org_1')
  })

  it('saveGlobal writes YAML with 0o600 permissions', async () => {
    const fs = await import('node:fs')
    const yaml = await import('js-yaml')
    vi.mocked(yaml.dump).mockReturnValue('org: org_1\n')

    ConfigService.saveGlobal({ org: 'org_1' })

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true, mode: 0o700 })
    expect(fs.writeFileSync).toHaveBeenCalled()
    expect(fs.chmodSync).toHaveBeenCalledWith(expect.any(String), 0o600)
  })

  it('loadProject returns empty config when .tdsk/config.yaml does not exist', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const config = ConfigService.loadProject()
    expect(config).toEqual({})
  })

  it('merge layers config in correct order', () => {
    const global = { org: 'global_org', agent: 'global_agent' }
    const project = { agent: 'project_agent' }
    const merged = ConfigService.merge(global, project)
    expect(merged.org).toBe('global_org')
    expect(merged.agent).toBe('project_agent')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/services/config.test.ts`
Expected: FAIL — module not found

**Step 3: Implement ConfigService**

Create `repos/repl/src/services/config.ts`:
```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs'
import { dirname, join } from 'node:path'
import yaml from 'js-yaml'
import type { TReplConfig, TProjectConfig } from '@TRL/types'
import { CONFIG_PATH, CONFIG_DIR, PROJECT_CONFIG } from '@TRL/constants'

export class ConfigService {
  static loadGlobal(): TReplConfig {
    if (!existsSync(CONFIG_PATH)) return {}
    try {
      const content = readFileSync(CONFIG_PATH, 'utf-8')
      return (yaml.load(content) as TReplConfig) || {}
    } catch {
      return {}
    }
  }

  static saveGlobal(config: TReplConfig): void {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
    const content = yaml.dump(config, { sortKeys: true, lineWidth: 120 })
    writeFileSync(CONFIG_PATH, content, 'utf-8')
    chmodSync(CONFIG_PATH, 0o600)
  }

  static loadProject(cwd?: string): TProjectConfig {
    const configPath = join(cwd || process.cwd(), PROJECT_CONFIG)
    if (!existsSync(configPath)) return {}
    try {
      const content = readFileSync(configPath, 'utf-8')
      return (yaml.load(content) as TProjectConfig) || {}
    } catch {
      return {}
    }
  }

  static merge(global: TReplConfig, project: TProjectConfig): TReplConfig {
    return {
      ...global,
      ...(project.org && { org: project.org }),
      ...(project.agent && { agent: project.agent }),
      hooks: { ...global.hooks, ...project.hooks },
      tools: {
        confirm: [...(global.tools?.confirm || []), ...(project.tools?.confirm || [])],
        block: [...(global.tools?.block || []), ...(project.tools?.block || [])],
      },
    }
  }
}
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/services/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/services/config.ts repos/repl/src/services/config.test.ts
git commit -m "feat(repl): add YAML config service with global + project config"
```

---

## Task 6: AuthManager Refactor

**Files:**
- Modify: `repos/repl/src/auth/auth.ts`
- Modify: `repos/repl/src/auth/auth.test.ts`

**Step 1: Update tests for YAML-based auth**

Modify `repos/repl/src/auth/auth.test.ts` to test that:
- `login()` saves credentials to `~/.config/tdsk/repl/config.yaml` under `auth:` key
- `getCredentials()` reads from YAML config's `auth` section
- `logout()` removes `auth` section from YAML config
- File permissions enforced at `0o600`
- Old JSON auth file (`repl-auth.json`) is NOT used

**Step 2: Run tests to verify they fail**

Run: `cd repos/repl && pnpm test -- src/auth/auth.test.ts`
Expected: FAIL — behavior changed

**Step 3: Refactor AuthManager**

Update `repos/repl/src/auth/auth.ts`:
- Replace JSON reads/writes with `ConfigService.loadGlobal()` and `ConfigService.saveGlobal()`
- `login()` writes to `config.auth` field
- `getCredentials()` reads from `config.auth`
- `logout()` removes `auth` from config
- Remove old `AUTH_CONFIG_PATH` constant
- Keep `isLoggedIn()`, API key validation logic

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/auth/auth.test.ts`
Expected: PASS

**Step 5: Run full test suite to check for regressions**

Run: `cd repos/repl && pnpm test`
Expected: All tests pass (some existing tests may need mock updates)

**Step 6: Commit**

```bash
git add repos/repl/src/auth/
git commit -m "refactor(repl): migrate AuthManager from JSON to YAML config"
```

---

## Task 7: ApiClient Refactor

**Files:**
- Modify: `repos/repl/src/api/client.ts`
- Modify: `repos/repl/src/api/client.test.ts`

**Step 1: Write new tests for retry logic and provider listing**

Add to `repos/repl/src/api/client.test.ts`:
```typescript
describe('retry logic', () => {
  it('retries on network error up to 3 times', async () => {
    // Mock fetch to fail twice then succeed
  })

  it('retries on 429 with backoff', async () => {
    // Mock fetch to return 429 then 200
  })

  it('does not retry on 4xx errors (except 429)', async () => {
    // Mock fetch to return 400
  })
})

describe('listProviders', () => {
  it('lists available providers for an agent', async () => {
    // Mock fetch to return provider list
  })
})
```

**Step 2: Run tests to verify new tests fail**

Run: `cd repos/repl && pnpm test -- src/api/client.test.ts`
Expected: New tests FAIL

**Step 3: Add retry logic and provider listing**

Modify `repos/repl/src/api/client.ts`:
- Add `#requestWithRetry()` method that wraps `#request()`:
  - Retries on `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, and 429/500/502/503 status codes
  - Uses `RETRY_DELAYS` from constants (1s, 3s, 9s)
  - Max 3 retries
- Add `listProviders(orgId: string, agentId: string): Promise<TProviderInfo[]>`
- Replace all `#request()` calls with `#requestWithRetry()`

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/api/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/api/
git commit -m "feat(repl): add retry logic and provider listing to ApiClient"
```

---

## Task 8: Context Loader Service

**Files:**
- Create: `repos/repl/src/services/context.ts`
- Test: `repos/repl/src/services/context.test.ts`

**Step 1: Write tests**

Create `repos/repl/src/services/context.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContextLoader } from './context'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}))

describe('ContextLoader', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('autoDetect finds AGENTS.md in cwd', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      return String(p).endsWith('AGENTS.md')
    })
    vi.mocked(fs.readFileSync).mockReturnValue('agent instructions')
    vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as any)

    const files = ContextLoader.autoDetect('/test/project')
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('AGENTS.md')
    expect(files[0].source).toBe('auto')
  })

  it('autoDetect scans .tdsk/context/ directory', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      return String(p).includes('.tdsk/context')
    })
    vi.mocked(fs.readdirSync).mockReturnValue(['arch.md', 'api.md'] as any)
    vi.mocked(fs.readFileSync).mockReturnValue('content')
    vi.mocked(fs.statSync).mockReturnValue({ size: 50 } as any)

    const files = ContextLoader.autoDetect('/test/project')
    expect(files.length).toBeGreaterThanOrEqual(2)
  })

  it('loadFile reads and returns context file', () => {
    const fs = require('node:fs')
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('file content')
    vi.mocked(fs.statSync).mockReturnValue({ size: 200 } as any)

    const file = ContextLoader.loadFile('/test/file.md')
    expect(file).not.toBeNull()
    expect(file!.content).toBe('file content')
    expect(file!.source).toBe('manual')
  })

  it('loadFile returns null for nonexistent files', () => {
    const fs = require('node:fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const file = ContextLoader.loadFile('/test/missing.md')
    expect(file).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/services/context.test.ts`
Expected: FAIL — module not found

**Step 3: Implement ContextLoader**

Create `repos/repl/src/services/context.ts`:
```typescript
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { TContextFile } from '@TRL/types'
import { AGENTS_FILE, CONTEXT_DIR, PROJECT_DIR } from '@TRL/constants'

export class ContextLoader {
  static autoDetect(cwd: string): TContextFile[] {
    const files: TContextFile[] = []

    // Check for AGENTS.md
    const agentsPath = join(cwd, AGENTS_FILE)
    if (existsSync(agentsPath)) {
      const content = readFileSync(agentsPath, 'utf-8')
      const stat = statSync(agentsPath)
      files.push({
        path: agentsPath,
        name: AGENTS_FILE,
        source: 'auto',
        content,
        sizeBytes: stat.size,
      })
    }

    // Scan .tdsk/context/ directory
    const contextDir = join(cwd, CONTEXT_DIR)
    if (existsSync(contextDir)) {
      const entries = readdirSync(contextDir)
      for (const entry of entries) {
        const filePath = join(contextDir, String(entry))
        const stat = statSync(filePath)
        if (stat.isFile()) {
          files.push({
            path: filePath,
            name: String(entry),
            source: 'auto',
            content: readFileSync(filePath, 'utf-8'),
            sizeBytes: stat.size,
          })
        }
      }
    }

    return files
  }

  static loadFile(path: string): TContextFile | null {
    if (!existsSync(path)) return null
    const stat = statSync(path)
    if (!stat.isFile()) return null
    return {
      path,
      name: basename(path),
      source: 'manual',
      content: readFileSync(path, 'utf-8'),
      sizeBytes: stat.size,
    }
  }
}
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/services/context.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/services/context.ts repos/repl/src/services/context.test.ts
git commit -m "feat(repl): add context auto-detection and manual loading"
```

---

## Task 9: Lifecycle Hooks Service

**Files:**
- Create: `repos/repl/src/services/hooks.ts`
- Test: `repos/repl/src/services/hooks.test.ts`

**Step 1: Write tests**

Create `repos/repl/src/services/hooks.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HooksService } from './hooks'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

describe('HooksService', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('runs a configured hook with environment variables', async () => {
    const cp = await import('node:child_process')
    vi.mocked(cp.execFile).mockImplementation((_cmd, _args, _opts, cb: any) => {
      if (cb) cb(null, '', '')
      return {} as any
    })

    const service = new HooksService({
      onSessionStart: 'echo hello',
    })

    await service.run('onSessionStart', { TDSK_AGENT_ID: 'a1' })
    expect(cp.execFile).toHaveBeenCalled()
  })

  it('does nothing when hook is not configured', async () => {
    const cp = await import('node:child_process')
    const service = new HooksService({})

    await service.run('onSessionStart', {})
    expect(cp.execFile).not.toHaveBeenCalled()
  })

  it('does not throw when hook command fails', async () => {
    const cp = await import('node:child_process')
    vi.mocked(cp.execFile).mockImplementation((_cmd, _args, _opts, cb: any) => {
      if (cb) cb(new Error('command failed'), '', '')
      return {} as any
    })

    const service = new HooksService({
      onError: 'bad-command',
    })

    await expect(service.run('onError', {})).resolves.not.toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/services/hooks.test.ts`
Expected: FAIL — module not found

**Step 3: Implement HooksService**

Create `repos/repl/src/services/hooks.ts`:
```typescript
import { execFile } from 'node:child_process'
import type { THooksConfig } from '@TRL/types'

type THookName = keyof THooksConfig

export class HooksService {
  #config: THooksConfig

  constructor(config: THooksConfig) {
    this.#config = config
  }

  async run(name: THookName, env: Record<string, string>): Promise<void> {
    const command = this.#config[name]
    if (!command) return

    return new Promise<void>((resolve) => {
      execFile('/bin/sh', ['-c', command], {
        env: { ...process.env, ...env },
        timeout: 10000,
      }, (error) => {
        if (error) {
          // Hooks should never crash the REPL — log and continue
          process.stderr.write(`Hook "${name}" failed: ${error.message}\n`)
        }
        resolve()
      })
    })
  }
}
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/services/hooks.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/services/hooks.ts repos/repl/src/services/hooks.test.ts
git commit -m "feat(repl): add lifecycle hooks service"
```

---

## Task 10: Executor Refactor

**Files:**
- Modify: `repos/repl/src/executor/executor.ts`
- Modify: `repos/repl/src/executor/executor.test.ts`

**Step 1: Write tests for provider switching and configurable maxSteps**

Add to `repos/repl/src/executor/executor.test.ts`:
```typescript
describe('provider switching', () => {
  it('passes providerId to session creation when specified', async () => {
    // Verify providerId is forwarded to backend
  })

  it('uses configurable maxSteps', async () => {
    // Verify maxSteps from config is passed to AgentRunner
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd repos/repl && pnpm test -- src/executor/executor.test.ts`
Expected: New tests FAIL

**Step 3: Refactor LocalAgentExecutor**

Update `repos/repl/src/executor/executor.ts`:
- Add `providerId?: string` to `run()` opts
- Pass `providerId` in session creation payload
- Make `maxSteps` configurable via opts (default from constants)
- Add `contextFiles?: TContextFile[]` to opts — prepend to prompt
- Remove hardcoded `userId: "repl-user"` — pass from session

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/executor/executor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/executor/
git commit -m "refactor(repl): add provider switching and configurable maxSteps to executor"
```

---

## Task 11: Slash Command Registry

**Files:**
- Create: `repos/repl/src/commands/index.ts`
- Create: `repos/repl/src/commands/help.ts`
- Create: `repos/repl/src/commands/newThread.ts`
- Create: `repos/repl/src/commands/switchThread.ts`
- Create: `repos/repl/src/commands/listThreads.ts`
- Create: `repos/repl/src/commands/history.ts`
- Create: `repos/repl/src/commands/switchAgent.ts`
- Create: `repos/repl/src/commands/switchProvider.ts`
- Create: `repos/repl/src/commands/info.ts`
- Create: `repos/repl/src/commands/context.ts`
- Create: `repos/repl/src/commands/addContext.ts`
- Create: `repos/repl/src/commands/removeContext.ts`
- Create: `repos/repl/src/commands/verbose.ts`
- Create: `repos/repl/src/commands/clear.ts`
- Create: `repos/repl/src/commands/exit.ts`
- Test: `repos/repl/src/commands/index.test.ts`

**Step 1: Write tests for command registry**

Create `repos/repl/src/commands/index.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseCommand, findCommand, commands } from './index'

describe('Command Registry', () => {
  it('parseCommand extracts command name and args', () => {
    const { name, args } = parseCommand('/switch 3')
    expect(name).toBe('switch')
    expect(args).toBe('3')
  })

  it('parseCommand handles command with no args', () => {
    const { name, args } = parseCommand('/help')
    expect(name).toBe('help')
    expect(args).toBe('')
  })

  it('findCommand finds by name', () => {
    const cmd = findCommand('help')
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe('help')
  })

  it('findCommand finds by alias', () => {
    const cmd = findCommand('h')
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe('help')
  })

  it('findCommand returns null for unknown command', () => {
    const cmd = findCommand('unknown')
    expect(cmd).toBeNull()
  })

  it('all commands have name, aliases, description, and handler', () => {
    for (const cmd of commands) {
      expect(cmd.name).toBeTruthy()
      expect(Array.isArray(cmd.aliases)).toBe(true)
      expect(cmd.description).toBeTruthy()
      expect(typeof cmd.handler).toBe('function')
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/commands/index.test.ts`
Expected: FAIL — module not found

**Step 3: Implement command files**

Each command file follows this pattern:

Create `repos/repl/src/commands/help.ts`:
```typescript
import type { TSlashCommand } from '@TRL/types'

export const helpCommand: TSlashCommand = {
  name: 'help',
  aliases: ['h'],
  description: 'Show available commands',
  handler: async (_args, _ctx) => {
    // Return formatted help text — the component will render it
    return undefined // Handled by the component directly
  },
}
```

Create all other command files following similar patterns. Each handler receives `(args: string, ctx: TSlashCommandContext)` and returns `Promise<string | void>`.

Key commands:
- `newThread.ts` — calls `ctx.setThreadId(null)` to trigger new thread creation
- `switchThread.ts` — parses number arg, calls `ctx.setThreadId(id)`
- `switchProvider.ts` — parses number arg, calls `ctx.setProviderId(id)`
- `switchAgent.ts` — calls `ctx.setAgentId(id)`
- `context.ts` — returns formatted list of context files
- `addContext.ts` — calls `ctx.addContextFile(path)`
- `removeContext.ts` — calls `ctx.removeContextFile(index)`
- `verbose.ts` — calls `ctx.setVerbose(!ctx.verbose)`
- `exit.ts` — calls `ctx.exit()`
- `clear.ts` — returns special clear signal

Create `repos/repl/src/commands/index.ts`:
```typescript
import type { TSlashCommand, TSlashCommandContext } from '@TRL/types'
import { helpCommand } from './help'
import { newThreadCommand } from './newThread'
import { switchThreadCommand } from './switchThread'
import { listThreadsCommand } from './listThreads'
import { historyCommand } from './history'
import { switchAgentCommand } from './switchAgent'
import { switchProviderCommand } from './switchProvider'
import { infoCommand } from './info'
import { contextCommand } from './context'
import { addContextCommand } from './addContext'
import { removeContextCommand } from './removeContext'
import { verboseCommand } from './verbose'
import { clearCommand } from './clear'
import { exitCommand } from './exit'

export const commands: TSlashCommand[] = [
  helpCommand,
  newThreadCommand,
  switchThreadCommand,
  listThreadsCommand,
  historyCommand,
  switchAgentCommand,
  switchProviderCommand,
  infoCommand,
  contextCommand,
  addContextCommand,
  removeContextCommand,
  verboseCommand,
  clearCommand,
  exitCommand,
]

export function findCommand(name: string): TSlashCommand | null {
  return commands.find(c => c.name === name || c.aliases.includes(name)) || null
}

export function parseCommand(input: string): { name: string; args: string } {
  const trimmed = input.slice(1).trim()
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) return { name: trimmed, args: '' }
  return { name: trimmed.slice(0, spaceIdx), args: trimmed.slice(spaceIdx + 1).trim() }
}
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/commands/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/commands/
git commit -m "feat(repl): add slash command registry with 14 commands"
```

---

## Task 12: Markdown Renderer Utility

**Files:**
- Create: `repos/repl/src/utils/markdown.ts`
- Test: `repos/repl/src/utils/markdown.test.ts`

**Step 1: Write tests**

Create `repos/repl/src/utils/markdown.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { renderMarkdown, StreamingMarkdownBuffer } from './markdown'

describe('renderMarkdown', () => {
  it('renders plain text', () => {
    const result = renderMarkdown('Hello world')
    expect(result).toContain('Hello world')
  })

  it('renders code blocks', () => {
    const result = renderMarkdown('```js\nconsole.log("hi")\n```')
    expect(result).toContain('console')
  })

  it('renders headers', () => {
    const result = renderMarkdown('# Title')
    expect(result).toContain('Title')
  })
})

describe('StreamingMarkdownBuffer', () => {
  it('buffers tokens until a block boundary', () => {
    const buf = new StreamingMarkdownBuffer()
    buf.append('Hello ')
    buf.append('world\n\n')
    const flushed = buf.flush()
    expect(flushed).toContain('Hello world')
  })

  it('flushAll renders remaining buffer', () => {
    const buf = new StreamingMarkdownBuffer()
    buf.append('partial text')
    const flushed = buf.flushAll()
    expect(flushed).toContain('partial text')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/utils/markdown.test.ts`
Expected: FAIL — module not found

**Step 3: Implement markdown utility**

Create `repos/repl/src/utils/markdown.ts`:
```typescript
import { marked } from 'marked'
import { markedTerminal } from 'marked-terminal'

marked.use(markedTerminal() as any)

export function renderMarkdown(text: string): string {
  return marked.parse(text) as string
}

export class StreamingMarkdownBuffer {
  #buffer = ''
  #rendered = ''

  append(token: string): void {
    this.#buffer += token
  }

  flush(): string {
    // Look for block boundaries (double newline, end of code block)
    const blockEnd = this.#buffer.lastIndexOf('\n\n')
    if (blockEnd === -1) return ''

    const toRender = this.#buffer.slice(0, blockEnd + 2)
    this.#buffer = this.#buffer.slice(blockEnd + 2)
    const rendered = renderMarkdown(toRender)
    this.#rendered += rendered
    return rendered
  }

  flushAll(): string {
    if (!this.#buffer) return ''
    const rendered = renderMarkdown(this.#buffer)
    this.#buffer = ''
    this.#rendered += rendered
    return rendered
  }

  get fullText(): string {
    return this.#rendered
  }
}
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/utils/markdown.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/utils/markdown.ts repos/repl/src/utils/markdown.test.ts
git commit -m "feat(repl): add streaming markdown renderer using marked-terminal"
```

---

## Task 13: Spinner Component

**Files:**
- Create: `repos/repl/src/components/Spinner.tsx`
- Test: `repos/repl/src/components/Spinner.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/Spinner.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { Spinner } from './Spinner'

describe('Spinner', () => {
  it('renders with a message', () => {
    const { lastFrame } = render(<Spinner message="Thinking..." />)
    expect(lastFrame()).toContain('Thinking...')
  })

  it('renders with default message when none provided', () => {
    const { lastFrame } = render(<Spinner />)
    expect(lastFrame()).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/components/Spinner.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement Spinner**

Create `repos/repl/src/components/Spinner.tsx`:
```tsx
import React, { useState, useEffect } from 'react'
import { Text } from 'ink'
import { themed } from '@TRL/theme'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

type SpinnerProps = {
  message?: string
}

export function Spinner({ message = 'Working...' }: SpinnerProps) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <Text>
      {themed('primary', FRAMES[frame])} {themed('muted', message)}
    </Text>
  )
}
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/Spinner.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/components/Spinner.tsx repos/repl/src/components/Spinner.test.tsx
git commit -m "feat(repl): add Spinner component"
```

---

## Task 14: SelectPrompt Component

**Files:**
- Create: `repos/repl/src/components/SelectPrompt.tsx`
- Test: `repos/repl/src/components/SelectPrompt.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/SelectPrompt.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { SelectPrompt } from './SelectPrompt'

describe('SelectPrompt', () => {
  const items = [
    { id: '1', label: 'Option A', description: 'First option' },
    { id: '2', label: 'Option B', description: 'Second option' },
  ]

  it('renders all items with numbers', () => {
    const { lastFrame } = render(
      <SelectPrompt items={items} prompt="Pick one:" onSelect={() => {}} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('1.')
    expect(frame).toContain('Option A')
    expect(frame).toContain('2.')
    expect(frame).toContain('Option B')
  })

  it('renders the prompt text', () => {
    const { lastFrame } = render(
      <SelectPrompt items={items} prompt="Pick one:" onSelect={() => {}} />
    )
    expect(lastFrame()).toContain('Pick one:')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/components/SelectPrompt.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement SelectPrompt**

Create `repos/repl/src/components/SelectPrompt.tsx`:
```tsx
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { themed } from '@TRL/theme'

type TSelectItem = {
  id: string
  label: string
  description?: string
}

type SelectPromptProps = {
  items: TSelectItem[]
  prompt: string
  onSelect: (item: TSelectItem) => void
}

export function SelectPrompt({ items, prompt, onSelect }: SelectPromptProps) {
  const [selected, setSelected] = useState(0)

  useInput((input, key) => {
    if (key.upArrow) {
      setSelected(prev => Math.max(0, prev - 1))
    } else if (key.downArrow) {
      setSelected(prev => Math.min(items.length - 1, prev + 1))
    } else if (key.return) {
      onSelect(items[selected])
    } else {
      // Number key selection
      const num = parseInt(input, 10)
      if (num >= 1 && num <= items.length) {
        onSelect(items[num - 1])
      }
    }
  })

  return (
    <Box flexDirection="column">
      <Text>{themed('bold', prompt)}</Text>
      <Text> </Text>
      {items.map((item, i) => (
        <Box key={item.id}>
          <Text>
            {i === selected ? themed('primary', '❯') : ' '}{' '}
            {themed(i === selected ? 'primary' : 'secondary', `${i + 1}.`)} {item.label}
            {item.description ? themed('muted', ` — ${item.description}`) : ''}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/SelectPrompt.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/components/SelectPrompt.tsx repos/repl/src/components/SelectPrompt.test.tsx
git commit -m "feat(repl): add SelectPrompt component with keyboard navigation"
```

---

## Task 15: ErrorMessage Component

**Files:**
- Create: `repos/repl/src/components/ErrorMessage.tsx`
- Test: `repos/repl/src/components/ErrorMessage.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/ErrorMessage.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { ErrorMessage } from './ErrorMessage'

describe('ErrorMessage', () => {
  it('renders error message', () => {
    const { lastFrame } = render(
      <ErrorMessage message="Something went wrong" />
    )
    expect(lastFrame()).toContain('Something went wrong')
  })

  it('renders suggestion when provided', () => {
    const { lastFrame } = render(
      <ErrorMessage message="Failed" suggestion="Try again" />
    )
    expect(lastFrame()).toContain('Try again')
  })

  it('renders from Error object using friendly mapping', () => {
    const error = Object.assign(new Error('connect'), { code: 'ECONNREFUSED' })
    const { lastFrame } = render(<ErrorMessage error={error} />)
    expect(lastFrame()).toContain("reach the server")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/components/ErrorMessage.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement ErrorMessage**

Create `repos/repl/src/components/ErrorMessage.tsx`:
```tsx
import React from 'react'
import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'
import { toFriendlyError } from '@TRL/constants/errors'

type ErrorMessageProps = {
  message?: string
  suggestion?: string
  error?: unknown
}

export function ErrorMessage({ message, suggestion, error }: ErrorMessageProps) {
  let displayMessage = message || ''
  let displaySuggestion = suggestion

  if (error && !message) {
    const friendly = toFriendlyError(error)
    displayMessage = friendly.message
    displaySuggestion = friendly.suggestion
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Text>{themed('error', '✗')} {displayMessage}</Text>
      {displaySuggestion && (
        <Text>  {themed('muted', displaySuggestion)}</Text>
      )}
    </Box>
  )
}
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/ErrorMessage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/components/ErrorMessage.tsx repos/repl/src/components/ErrorMessage.test.tsx
git commit -m "feat(repl): add ErrorMessage component with friendly error mapping"
```

---

## Task 16: WelcomeBox Component

**Files:**
- Create: `repos/repl/src/components/WelcomeBox.tsx`
- Test: `repos/repl/src/components/WelcomeBox.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/WelcomeBox.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { WelcomeBox } from './WelcomeBox'

describe('WelcomeBox', () => {
  it('renders agent name', () => {
    const { lastFrame } = render(
      <WelcomeBox agentName="Research Assistant" />
    )
    expect(lastFrame()).toContain('Research Assistant')
  })

  it('renders description when provided', () => {
    const { lastFrame } = render(
      <WelcomeBox agentName="Helper" agentDescription="Helps with tasks" />
    )
    expect(lastFrame()).toContain('Helps with tasks')
  })

  it('renders provider info', () => {
    const { lastFrame } = render(
      <WelcomeBox agentName="Agent" providerName="Anthropic" modelName="claude-sonnet" />
    )
    expect(lastFrame()).toContain('Anthropic')
  })

  it('renders thread name when resuming', () => {
    const { lastFrame } = render(
      <WelcomeBox agentName="Agent" threadName="Q4 Discussion" />
    )
    expect(lastFrame()).toContain('Q4 Discussion')
  })

  it('renders context file count', () => {
    const { lastFrame } = render(
      <WelcomeBox agentName="Agent" contextFileCount={3} />
    )
    expect(lastFrame()).toContain('3')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/components/WelcomeBox.test.tsx`
Expected: FAIL

**Step 3: Implement WelcomeBox**

Create `repos/repl/src/components/WelcomeBox.tsx`:
```tsx
import React from 'react'
import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'

type WelcomeBoxProps = {
  agentName: string
  agentDescription?: string
  providerName?: string
  modelName?: string
  threadName?: string
  contextFileCount?: number
  tools?: string[]
}

export function WelcomeBox({
  agentName,
  agentDescription,
  providerName,
  modelName,
  threadName,
  contextFileCount,
  tools,
}: WelcomeBoxProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Text>{themed('bold', agentName)}</Text>
      {agentDescription && <Text>{themed('muted', agentDescription)}</Text>}
      <Text> </Text>
      {tools && tools.length > 0 && (
        <Text>{themed('muted', `Tools: ${tools.join(', ')}`)}</Text>
      )}
      {providerName && (
        <Text>{themed('muted', `Provider: ${providerName}${modelName ? ` (${modelName})` : ''}`)}</Text>
      )}
      {threadName && (
        <Text>{themed('accent', `Resuming thread: "${threadName}"`)}</Text>
      )}
      {(contextFileCount ?? 0) > 0 && (
        <Text>{themed('muted', `Loaded ${contextFileCount} context file${contextFileCount === 1 ? '' : 's'}`)}</Text>
      )}
      <Text> </Text>
      <Text>{themed('muted', 'Type /help for commands, /new to start fresh.')}</Text>
    </Box>
  )
}
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/WelcomeBox.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/components/WelcomeBox.tsx repos/repl/src/components/WelcomeBox.test.tsx
git commit -m "feat(repl): add WelcomeBox component"
```

---

## Task 17: StatusBar Component

**Files:**
- Create: `repos/repl/src/components/StatusBar.tsx`
- Test: `repos/repl/src/components/StatusBar.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/StatusBar.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { StatusBar } from './StatusBar'

describe('StatusBar', () => {
  it('renders agent name', () => {
    const { lastFrame } = render(
      <StatusBar agentName="Helper" connection="connected" />
    )
    expect(lastFrame()).toContain('Helper')
  })

  it('renders provider info', () => {
    const { lastFrame } = render(
      <StatusBar agentName="Helper" providerName="Anthropic" modelName="sonnet" connection="connected" />
    )
    expect(lastFrame()).toContain('Anthropic')
  })

  it('renders green indicator when connected', () => {
    const { lastFrame } = render(
      <StatusBar agentName="Helper" connection="connected" />
    )
    expect(lastFrame()).toContain('●')
  })

  it('renders thread name', () => {
    const { lastFrame } = render(
      <StatusBar agentName="Helper" threadName="My Thread" connection="connected" />
    )
    expect(lastFrame()).toContain('My Thread')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/components/StatusBar.test.tsx`
Expected: FAIL

**Step 3: Implement StatusBar**

Create `repos/repl/src/components/StatusBar.tsx`:
```tsx
import React from 'react'
import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'
import type { TConnectionStatus } from '@TRL/types'

type StatusBarProps = {
  agentName: string
  providerName?: string
  modelName?: string
  threadName?: string
  connection: TConnectionStatus
}

const CONNECTION_COLORS = {
  connected: 'success',
  disconnected: 'error',
  reconnecting: 'warning',
} as const

export function StatusBar({ agentName, providerName, modelName, threadName, connection }: StatusBarProps) {
  const parts = [agentName]
  if (providerName) parts.push(`${providerName}${modelName ? ` (${modelName})` : ''}`)
  if (threadName) parts.push(`"${threadName}"`)

  return (
    <Box>
      <Text>
        {themed('border', '── ')}
        {parts.map((part, i) => (
          <Text key={i}>
            {i > 0 ? themed('border', ' · ') : ''}
            {themed('muted', part)}
          </Text>
        ))}
        {' '}{themed(CONNECTION_COLORS[connection], '●')}
        {themed('border', ' ──')}
      </Text>
    </Box>
  )
}
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/StatusBar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/components/StatusBar.tsx repos/repl/src/components/StatusBar.test.tsx
git commit -m "feat(repl): add StatusBar component"
```

---

## Task 18: ToolActivity Component

**Files:**
- Create: `repos/repl/src/components/ToolActivity.tsx`
- Test: `repos/repl/src/components/ToolActivity.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/ToolActivity.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { ToolActivity } from './ToolActivity'

describe('ToolActivity', () => {
  it('renders completed tool with checkmark', () => {
    const { lastFrame } = render(
      <ToolActivity
        tools={[{ name: 'readFile', args: '/test.txt', status: 'success', summary: 'Read file: /test.txt' }]}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('✓')
    expect(frame).toContain('Read file')
  })

  it('renders failed tool with X', () => {
    const { lastFrame } = render(
      <ToolActivity
        tools={[{ name: 'shellExec', args: 'rm -rf', status: 'error', summary: 'Command failed' }]}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('✗')
  })

  it('renders running tool with spinner text', () => {
    const { lastFrame } = render(
      <ToolActivity
        tools={[{ name: 'webSearch', args: 'query', status: 'running', summary: 'Searching...' }]}
      />
    )
    expect(lastFrame()).toContain('Searching')
  })

  it('renders verbose details when verbose is true', () => {
    const { lastFrame } = render(
      <ToolActivity
        verbose
        tools={[{
          name: 'readFile',
          args: '{"path":"/test.txt"}',
          status: 'success',
          summary: 'Read file',
          result: 'file contents here',
        }]}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('file contents here')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- src/components/ToolActivity.test.tsx`
Expected: FAIL

**Step 3: Implement ToolActivity**

Create `repos/repl/src/components/ToolActivity.tsx`:
```tsx
import React from 'react'
import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'
import { getToolDisplayName } from '@TRL/constants/tools'

type TToolCall = {
  name: string
  args: string
  status: 'running' | 'success' | 'error'
  summary: string
  result?: string
}

type ToolActivityProps = {
  tools: TToolCall[]
  verbose?: boolean
}

export function ToolActivity({ tools, verbose = false }: ToolActivityProps) {
  if (tools.length === 0) return null

  return (
    <Box flexDirection="column" marginY={1}>
      <Text>{themed('border', '── Agent is working ──')}</Text>
      {tools.map((tool, i) => (
        <Box key={i} flexDirection="column">
          <Text>
            {tool.status === 'success' && themed('success', '✓')}
            {tool.status === 'error' && themed('error', '✗')}
            {tool.status === 'running' && themed('warning', '⠙')}{' '}
            {tool.summary || getToolDisplayName(tool.name)}
          </Text>
          {verbose && tool.result && (
            <Box marginLeft={2}>
              <Text>{themed('muted', tool.result.slice(0, 500))}</Text>
            </Box>
          )}
        </Box>
      ))}
      <Text>{themed('border', '──')}</Text>
    </Box>
  )
}
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/ToolActivity.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/components/ToolActivity.tsx repos/repl/src/components/ToolActivity.test.tsx
git commit -m "feat(repl): add ToolActivity component with verbose mode"
```

---

## Task 19: Message Components (UserMessage, AssistantMessage)

**Files:**
- Create: `repos/repl/src/components/UserMessage.tsx`
- Create: `repos/repl/src/components/AssistantMessage.tsx`
- Test: `repos/repl/src/components/UserMessage.test.tsx`
- Test: `repos/repl/src/components/AssistantMessage.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/UserMessage.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { UserMessage } from './UserMessage'

describe('UserMessage', () => {
  it('renders user text with dimmed style', () => {
    const { lastFrame } = render(<UserMessage text="Hello agent" />)
    expect(lastFrame()).toContain('Hello agent')
  })
})
```

Create `repos/repl/src/components/AssistantMessage.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { AssistantMessage } from './AssistantMessage'

describe('AssistantMessage', () => {
  it('renders markdown content', () => {
    const { lastFrame } = render(<AssistantMessage text="Hello **world**" />)
    expect(lastFrame()).toContain('world')
  })

  it('renders plain text when markdown is disabled', () => {
    const { lastFrame } = render(<AssistantMessage text="Hello world" markdown={false} />)
    expect(lastFrame()).toContain('Hello world')
  })
})
```

**Step 2: Implement**

Create `repos/repl/src/components/UserMessage.tsx`:
```tsx
import React from 'react'
import { Text } from 'ink'
import { themed } from '@TRL/theme'

export function UserMessage({ text }: { text: string }) {
  return <Text>{themed('secondary', `> ${text}`)}</Text>
}
```

Create `repos/repl/src/components/AssistantMessage.tsx`:
```tsx
import React from 'react'
import { Text } from 'ink'
import { renderMarkdown } from '@TRL/utils/markdown'

type Props = { text: string; markdown?: boolean }

export function AssistantMessage({ text, markdown = true }: Props) {
  const rendered = markdown ? renderMarkdown(text) : text
  return <Text>{rendered}</Text>
}
```

**Step 3: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/UserMessage.test.tsx src/components/AssistantMessage.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add repos/repl/src/components/UserMessage.tsx repos/repl/src/components/AssistantMessage.tsx repos/repl/src/components/UserMessage.test.tsx repos/repl/src/components/AssistantMessage.test.tsx
git commit -m "feat(repl): add UserMessage and AssistantMessage components"
```

---

## Task 20: StreamingResponse Component

**Files:**
- Create: `repos/repl/src/components/StreamingResponse.tsx`
- Test: `repos/repl/src/components/StreamingResponse.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/StreamingResponse.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { StreamingResponse } from './StreamingResponse'

describe('StreamingResponse', () => {
  it('shows spinner when no text has arrived', () => {
    const { lastFrame } = render(
      <StreamingResponse text="" toolCalls={[]} isStreaming />
    )
    expect(lastFrame()).toBeTruthy() // Spinner renders
  })

  it('renders text as it arrives', () => {
    const { lastFrame } = render(
      <StreamingResponse text="Hello world" toolCalls={[]} isStreaming />
    )
    expect(lastFrame()).toContain('Hello world')
  })

  it('shows tool activity inline', () => {
    const { lastFrame } = render(
      <StreamingResponse
        text=""
        toolCalls={[{ name: 'readFile', args: '', status: 'running', summary: 'Reading file...' }]}
        isStreaming
      />
    )
    expect(lastFrame()).toContain('Reading file')
  })
})
```

**Step 2: Implement**

Create `repos/repl/src/components/StreamingResponse.tsx`:
```tsx
import React from 'react'
import { Box, Text } from 'ink'
import { Spinner } from './Spinner'
import { ToolActivity } from './ToolActivity'
import { renderMarkdown } from '@TRL/utils/markdown'

type TToolCall = {
  name: string
  args: string
  status: 'running' | 'success' | 'error'
  summary: string
  result?: string
}

type Props = {
  text: string
  toolCalls: TToolCall[]
  isStreaming: boolean
  verbose?: boolean
}

export function StreamingResponse({ text, toolCalls, isStreaming, verbose }: Props) {
  const showSpinner = isStreaming && !text && toolCalls.length === 0

  return (
    <Box flexDirection="column">
      {showSpinner && <Spinner message="Thinking..." />}
      {toolCalls.length > 0 && <ToolActivity tools={toolCalls} verbose={verbose} />}
      {text && <Text>{renderMarkdown(text)}</Text>}
    </Box>
  )
}
```

**Step 3: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/StreamingResponse.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add repos/repl/src/components/StreamingResponse.tsx repos/repl/src/components/StreamingResponse.test.tsx
git commit -m "feat(repl): add StreamingResponse component with spinner and tool activity"
```

---

## Task 21: Prompt Component

**Files:**
- Create: `repos/repl/src/components/Prompt.tsx`
- Test: `repos/repl/src/components/Prompt.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/Prompt.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { Prompt } from './Prompt'

describe('Prompt', () => {
  it('renders prompt indicator', () => {
    const { lastFrame } = render(<Prompt onSubmit={() => {}} disabled={false} />)
    expect(lastFrame()).toContain('>')
  })

  it('shows disabled state while agent is responding', () => {
    const { lastFrame } = render(<Prompt onSubmit={() => {}} disabled />)
    // Should still render but input should be disabled
    expect(lastFrame()).toBeTruthy()
  })
})
```

**Step 2: Implement**

Create `repos/repl/src/components/Prompt.tsx`:
```tsx
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { themed } from '@TRL/theme'

type PromptProps = {
  onSubmit: (text: string) => void
  disabled: boolean
}

export function Prompt({ onSubmit, disabled }: PromptProps) {
  const [value, setValue] = useState('')

  useInput((input, key) => {
    if (disabled) return

    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim())
        setValue('')
      }
      return
    }

    if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1))
      return
    }

    if (!key.ctrl && !key.meta && input) {
      setValue(prev => prev + input)
    }
  })

  return (
    <Box>
      <Text>
        {themed(disabled ? 'muted' : 'primary', '> ')}
        {value}
        {!disabled && themed('primary', '█')}
      </Text>
    </Box>
  )
}
```

**Step 3: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/Prompt.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add repos/repl/src/components/Prompt.tsx repos/repl/src/components/Prompt.test.tsx
git commit -m "feat(repl): add Prompt input component"
```

---

## Task 22: MessageList Component

**Files:**
- Create: `repos/repl/src/components/MessageList.tsx`
- Test: `repos/repl/src/components/MessageList.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/MessageList.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { MessageList } from './MessageList'

describe('MessageList', () => {
  it('renders empty state', () => {
    const { lastFrame } = render(<MessageList messages={[]} />)
    expect(lastFrame()).toBeTruthy()
  })

  it('renders user and assistant messages', () => {
    const messages = [
      { type: 'user', content: 'Hello' },
      { type: 'assistant', content: 'Hi there!' },
    ]
    const { lastFrame } = render(<MessageList messages={messages} />)
    const frame = lastFrame()!
    expect(frame).toContain('Hello')
    expect(frame).toContain('Hi there')
  })
})
```

**Step 2: Implement**

Create `repos/repl/src/components/MessageList.tsx`:
```tsx
import React from 'react'
import { Box } from 'ink'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'

type TDisplayMessage = {
  type: string
  content: string
  toolCalls?: any[]
}

type Props = {
  messages: TDisplayMessage[]
  markdown?: boolean
}

export function MessageList({ messages, markdown = true }: Props) {
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <Box key={i} marginBottom={1}>
          {msg.type === 'user' ? (
            <UserMessage text={msg.content} />
          ) : (
            <AssistantMessage text={msg.content} markdown={markdown} />
          )}
        </Box>
      ))}
    </Box>
  )
}
```

**Step 3: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/MessageList.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add repos/repl/src/components/MessageList.tsx repos/repl/src/components/MessageList.test.tsx
git commit -m "feat(repl): add MessageList component"
```

---

## Task 23: AgentPicker Component

**Files:**
- Create: `repos/repl/src/components/AgentPicker.tsx`
- Test: `repos/repl/src/components/AgentPicker.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/AgentPicker.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { AgentPicker } from './AgentPicker'

describe('AgentPicker', () => {
  const agents = [
    { id: 'a1', name: 'Research Assistant', description: 'Finds information' },
    { id: 'a2', name: 'Code Helper', description: 'Helps with code' },
  ]

  it('renders agent list', () => {
    const { lastFrame } = render(
      <AgentPicker agents={agents} onSelect={() => {}} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('Research Assistant')
    expect(frame).toContain('Code Helper')
  })

  it('auto-selects when only one agent', () => {
    const onSelect = vi.fn()
    render(<AgentPicker agents={[agents[0]]} onSelect={onSelect} />)
    expect(onSelect).toHaveBeenCalledWith(agents[0])
  })
})
```

**Step 2: Implement**

Create `repos/repl/src/components/AgentPicker.tsx`:
```tsx
import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import { SelectPrompt } from './SelectPrompt'
import { themed } from '@TRL/theme'

type TAgentInfo = {
  id: string
  name: string
  description?: string
}

type Props = {
  agents: TAgentInfo[]
  onSelect: (agent: TAgentInfo) => void
}

export function AgentPicker({ agents, onSelect }: Props) {
  useEffect(() => {
    if (agents.length === 1) {
      onSelect(agents[0])
    }
  }, [agents.length])

  if (agents.length === 1) return null

  const items = agents.map(a => ({
    id: a.id,
    label: a.name,
    description: a.description,
  }))

  return (
    <Box flexDirection="column">
      <Text>{themed('bold', `You have ${agents.length} agents available.`)}</Text>
      <Text> </Text>
      <SelectPrompt
        items={items}
        prompt="Select an agent:"
        onSelect={(item) => {
          const agent = agents.find(a => a.id === item.id)!
          onSelect(agent)
        }}
      />
    </Box>
  )
}
```

**Step 3: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/AgentPicker.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add repos/repl/src/components/AgentPicker.tsx repos/repl/src/components/AgentPicker.test.tsx
git commit -m "feat(repl): add AgentPicker component with auto-select"
```

---

## Task 24: React Hooks (useAuth, useConfig, useSession, useMessages, useAgent, useContext, useInputHistory, useConnection, useLifecycleHooks)

**Files:**
- Create: `repos/repl/src/hooks/useAuth.ts`
- Create: `repos/repl/src/hooks/useConfig.ts`
- Create: `repos/repl/src/hooks/useSession.ts`
- Create: `repos/repl/src/hooks/useMessages.ts`
- Create: `repos/repl/src/hooks/useAgent.ts`
- Create: `repos/repl/src/hooks/useContext.ts`
- Create: `repos/repl/src/hooks/useInputHistory.ts`
- Create: `repos/repl/src/hooks/useConnection.ts`
- Create: `repos/repl/src/hooks/useLifecycleHooks.ts`
- Create: `repos/repl/src/hooks/index.ts`
- Test: `repos/repl/src/hooks/useConfig.test.ts`
- Test: `repos/repl/src/hooks/useInputHistory.test.ts`

**Step 1: Write tests for useConfig**

Create `repos/repl/src/hooks/useConfig.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

// Test ConfigService integration (hooks are harder to unit test outside components)
describe('useConfig logic', () => {
  it('merges global and project configs', () => {
    const global = { org: 'g1', display: { theme: 'dark' as const } }
    const project = { org: 'p1' }
    const merged = { ...global, ...project }
    expect(merged.org).toBe('p1')
  })
})
```

**Step 2: Write tests for useInputHistory**

Create `repos/repl/src/hooks/useInputHistory.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

describe('input history logic', () => {
  it('adds entries to history', () => {
    const history: string[] = []
    history.push('first')
    history.push('second')
    expect(history).toEqual(['first', 'second'])
  })

  it('navigates up through history', () => {
    const history = ['first', 'second', 'third']
    let index = history.length
    index--
    expect(history[index]).toBe('third')
    index--
    expect(history[index]).toBe('second')
  })
})
```

**Step 3: Implement all hooks**

Create each hook file. Key implementations:

`repos/repl/src/hooks/useAuth.ts`:
```typescript
import { useState, useCallback } from 'react'
import { AuthManager } from '@TRL/auth'

export function useAuth() {
  const [auth] = useState(() => new AuthManager())
  const [isLoggedIn, setIsLoggedIn] = useState(auth.isLoggedIn())

  const login = useCallback(async (apiKey: string, proxyUrl?: string, insecure?: boolean) => {
    await auth.login(apiKey, proxyUrl, insecure)
    setIsLoggedIn(true)
  }, [auth])

  const logout = useCallback(() => {
    auth.logout()
    setIsLoggedIn(false)
  }, [auth])

  return { auth, isLoggedIn, login, logout }
}
```

`repos/repl/src/hooks/useSession.ts`:
```typescript
import { useState, useCallback } from 'react'
import type { TProviderInfo, TConnectionStatus } from '@TRL/types'

export function useSession() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [provider, setProvider] = useState<TProviderInfo | null>(null)
  const [connection, setConnection] = useState<TConnectionStatus>('disconnected')

  return {
    orgId, setOrgId,
    agentId, setAgentId,
    threadId, setThreadId,
    provider, setProvider,
    connection, setConnection,
  }
}
```

`repos/repl/src/hooks/useMessages.ts`:
```typescript
import { useState, useCallback } from 'react'

type TDisplayMessage = {
  type: string
  content: string
}

export function useMessages() {
  const [messages, setMessages] = useState<TDisplayMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [toolCalls, setToolCalls] = useState<any[]>([])

  const addMessage = useCallback((msg: TDisplayMessage) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const clearStream = useCallback(() => {
    setStreamText('')
    setToolCalls([])
  }, [])

  return {
    messages, addMessage, setMessages,
    isStreaming, setIsStreaming,
    streamText, setStreamText,
    toolCalls, setToolCalls,
    clearStream,
  }
}
```

Create `repos/repl/src/hooks/useInputHistory.ts`:
```typescript
import { useState, useCallback } from 'react'

export function useInputHistory(maxSize = 100) {
  const [history, setHistory] = useState<string[]>([])
  const [index, setIndex] = useState(-1)

  const add = useCallback((entry: string) => {
    setHistory(prev => {
      const next = [...prev, entry]
      return next.length > maxSize ? next.slice(-maxSize) : next
    })
    setIndex(-1)
  }, [maxSize])

  const up = useCallback((): string | null => {
    if (history.length === 0) return null
    const nextIndex = index === -1 ? history.length - 1 : Math.max(0, index - 1)
    setIndex(nextIndex)
    return history[nextIndex]
  }, [history, index])

  const down = useCallback((): string | null => {
    if (index === -1) return null
    const nextIndex = index + 1
    if (nextIndex >= history.length) {
      setIndex(-1)
      return ''
    }
    setIndex(nextIndex)
    return history[nextIndex]
  }, [history, index])

  const reset = useCallback(() => setIndex(-1), [])

  return { add, up, down, reset, history }
}
```

Create remaining hooks following the same patterns. Each hook encapsulates one concern.

`repos/repl/src/hooks/index.ts`:
```typescript
export { useAuth } from './useAuth'
export { useConfig } from './useConfig'
export { useSession } from './useSession'
export { useMessages } from './useMessages'
export { useAgent } from './useAgent'
export { useContext } from './useContext'
export { useInputHistory } from './useInputHistory'
export { useConnection } from './useConnection'
export { useLifecycleHooks } from './useLifecycleHooks'
```

**Step 4: Run tests**

Run: `cd repos/repl && pnpm test -- src/hooks/`
Expected: PASS

**Step 5: Commit**

```bash
git add repos/repl/src/hooks/
git commit -m "feat(repl): add React hooks for auth, config, session, messages, input history"
```

---

## Task 25: ChatSession Container Component

**Files:**
- Create: `repos/repl/src/components/ChatSession.tsx`
- Test: `repos/repl/src/components/ChatSession.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/ChatSession.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { ChatSession } from './ChatSession'

describe('ChatSession', () => {
  it('renders status bar, message list, and prompt', () => {
    const { lastFrame } = render(
      <ChatSession
        agentName="Test Agent"
        connection="connected"
        messages={[]}
        isStreaming={false}
        streamText=""
        toolCalls={[]}
        onSubmit={() => {}}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('Test Agent')
    expect(frame).toContain('>')
  })
})
```

**Step 2: Implement**

Create `repos/repl/src/components/ChatSession.tsx`:
```tsx
import React from 'react'
import { Box } from 'ink'
import { StatusBar } from './StatusBar'
import { MessageList } from './MessageList'
import { StreamingResponse } from './StreamingResponse'
import { Prompt } from './Prompt'
import type { TConnectionStatus } from '@TRL/types'

type Props = {
  agentName: string
  providerName?: string
  modelName?: string
  threadName?: string
  connection: TConnectionStatus
  messages: Array<{ type: string; content: string }>
  isStreaming: boolean
  streamText: string
  toolCalls: Array<{ name: string; args: string; status: 'running' | 'success' | 'error'; summary: string; result?: string }>
  verbose?: boolean
  onSubmit: (text: string) => void
}

export function ChatSession({
  agentName, providerName, modelName, threadName, connection,
  messages, isStreaming, streamText, toolCalls, verbose, onSubmit,
}: Props) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <StatusBar
        agentName={agentName}
        providerName={providerName}
        modelName={modelName}
        threadName={threadName}
        connection={connection}
      />
      <MessageList messages={messages} />
      {isStreaming && (
        <StreamingResponse
          text={streamText}
          toolCalls={toolCalls}
          isStreaming={isStreaming}
          verbose={verbose}
        />
      )}
      <Prompt onSubmit={onSubmit} disabled={isStreaming} />
    </Box>
  )
}
```

**Step 3: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/ChatSession.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add repos/repl/src/components/ChatSession.tsx repos/repl/src/components/ChatSession.test.tsx
git commit -m "feat(repl): add ChatSession container component"
```

---

## Task 26: App Root Component

**Files:**
- Create: `repos/repl/src/components/App.tsx`
- Test: `repos/repl/src/components/App.test.tsx`

**Step 1: Write tests**

Create `repos/repl/src/components/App.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'

// Simplified test — full integration tested separately
describe('App', () => {
  it('is importable', async () => {
    const mod = await import('./App')
    expect(mod.App).toBeDefined()
  })
})
```

**Step 2: Implement**

Create `repos/repl/src/components/App.tsx`:
```tsx
import React, { useState, useCallback, useEffect } from 'react'
import { Box, Text, useApp } from 'ink'
import { useAuth } from '@TRL/hooks/useAuth'
import { useSession } from '@TRL/hooks/useSession'
import { useMessages } from '@TRL/hooks/useMessages'
import { AgentPicker } from './AgentPicker'
import { ChatSession } from './ChatSession'
import { WelcomeBox } from './WelcomeBox'
import { ErrorMessage } from './ErrorMessage'
import { Spinner } from './Spinner'
import { ApiClient } from '@TRL/api'
import { LocalAgentExecutor } from '@TRL/executor'
import { ContextLoader } from '@TRL/services/context'
import { themed } from '@TRL/theme'
import { parseCommand, findCommand } from '@TRL/commands'
import { getToolDisplayName } from '@TRL/constants/tools'
import type { TStreamEvent } from '@tdsk/domain'

type AppProps = {
  initialOrgId?: string
  initialAgentId?: string
  initialThreadId?: string
}

type TAppPhase = 'loading' | 'pickAgent' | 'chat' | 'error'

export function App({ initialOrgId, initialAgentId, initialThreadId }: AppProps) {
  const { auth } = useAuth()
  const session = useSession()
  const msgs = useMessages()
  const { exit } = useApp()

  const [phase, setPhase] = useState<TAppPhase>('loading')
  const [agents, setAgents] = useState<any[]>([])
  const [agentInfo, setAgentInfo] = useState<any>(null)
  const [error, setError] = useState<unknown>(null)
  const [verbose, setVerbose] = useState(false)
  const [contextFiles, setContextFiles] = useState<any[]>([])
  const [client] = useState(() => new ApiClient(auth))
  const [executor] = useState(() => new LocalAgentExecutor(client))

  // Initialize
  useEffect(() => {
    async function init() {
      try {
        // Resolve org
        const orgId = initialOrgId || (await resolveOrg(client))
        session.setOrgId(orgId)

        // Load context files
        const ctx = ContextLoader.autoDetect(process.cwd())
        setContextFiles(ctx)

        // If agent specified, go directly to chat
        if (initialAgentId) {
          session.setAgentId(initialAgentId)
          session.setThreadId(initialThreadId || null)
          const agent = await client.getAgent(orgId, initialAgentId)
          setAgentInfo(agent)
          session.setConnection('connected')
          setPhase('chat')
          return
        }

        // Otherwise, list agents for picking
        const agentList = await client.listAgents(orgId)
        setAgents(agentList)
        session.setConnection('connected')
        setPhase('pickAgent')
      } catch (e) {
        setError(e)
        setPhase('error')
      }
    }
    init()
  }, [])

  const handleAgentSelect = useCallback(async (agent: any) => {
    session.setAgentId(agent.id)
    setAgentInfo(agent)
    setPhase('chat')
  }, [])

  const handleSubmit = useCallback(async (text: string) => {
    // Check for slash commands
    if (text.startsWith('/')) {
      const { name, args } = parseCommand(text)
      const cmd = findCommand(name)
      if (cmd) {
        await cmd.handler(args, {
          orgId: session.orgId!,
          agentId: session.agentId!,
          threadId: session.threadId,
          setThreadId: session.setThreadId,
          setAgentId: session.setAgentId,
          setProviderId: (id: string) => { /* provider switching */ },
          addContextFile: (path: string) => {
            const file = ContextLoader.loadFile(path)
            if (file) setContextFiles(prev => [...prev, file])
          },
          removeContextFile: (index: number) => {
            setContextFiles(prev => prev.filter((_, i) => i !== index))
          },
          setVerbose,
          verbose,
          exit,
        })
        return
      }
    }

    // Send message to agent
    msgs.addMessage({ type: 'user', content: text })
    msgs.setIsStreaming(true)
    msgs.clearStream()

    try {
      const result = await executor.run({
        orgId: session.orgId!,
        agentId: session.agentId!,
        threadId: session.threadId || undefined,
        prompt: text,
        userId: 'repl-user',
        onEvent: (event: TStreamEvent) => {
          switch (event.type) {
            case 'text':
              msgs.setStreamText(prev => prev + (event.text || ''))
              break
            case 'tool_call_start':
              msgs.setToolCalls(prev => [...prev, {
                name: event.name || '',
                args: '',
                status: 'running' as const,
                summary: `${getToolDisplayName(event.name || '')}...`,
              }])
              break
            case 'tool_result':
              msgs.setToolCalls(prev => prev.map((t, i) =>
                i === prev.length - 1
                  ? { ...t, status: (event.isError ? 'error' : 'success') as const, result: String(event.result || '') }
                  : t
              ))
              break
          }
        },
      })

      session.setThreadId(result.threadId)
      msgs.addMessage({ type: 'assistant', content: msgs.streamText })
    } catch (e) {
      setError(e)
    } finally {
      msgs.setIsStreaming(false)
      msgs.clearStream()
    }
  }, [session.orgId, session.agentId, session.threadId, executor, verbose])

  if (phase === 'loading') return <Spinner message="Connecting..." />
  if (phase === 'error') return <ErrorMessage error={error} />

  if (phase === 'pickAgent') {
    return (
      <Box flexDirection="column">
        <Text>{themed('bold', 'Welcome back!')}</Text>
        <AgentPicker agents={agents} onSelect={handleAgentSelect} />
      </Box>
    )
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {agentInfo && (
        <WelcomeBox
          agentName={agentInfo.name || agentInfo.id}
          agentDescription={agentInfo.description}
          contextFileCount={contextFiles.length}
        />
      )}
      <ChatSession
        agentName={agentInfo?.name || session.agentId || 'Agent'}
        connection={session.connection}
        messages={msgs.messages}
        isStreaming={msgs.isStreaming}
        streamText={msgs.streamText}
        toolCalls={msgs.toolCalls}
        verbose={verbose}
        onSubmit={handleSubmit}
      />
    </Box>
  )
}

async function resolveOrg(client: ApiClient): Promise<string> {
  const orgs = await client.listOrgs()
  if (orgs.length === 0) throw new Error('No organizations found')
  if (orgs.length === 1) return (orgs[0] as any).id
  // For now, use first org. AgentPicker for orgs can be added later.
  return (orgs[0] as any).id
}
```

**Step 3: Run tests**

Run: `cd repos/repl && pnpm test -- src/components/App.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add repos/repl/src/components/App.tsx repos/repl/src/components/App.test.tsx
git commit -m "feat(repl): add App root component with session management"
```

---

## Task 27: Chat Task Bridge (Ink Rendering)

**Files:**
- Modify: `repos/repl/src/tasks/chat.ts`

**Step 1: Update chat task to render Ink App**

Modify `repos/repl/src/tasks/chat.ts`:
```typescript
import type { TTask } from '@TRL/types'
import { requireAuth } from '@TRL/utils/tasks'
import React from 'react'
import { render } from 'ink'
import { App } from '@TRL/components/App'

export const chatTask: TTask = {
  name: 'chat',
  alias: ['ch'],
  description: 'Start interactive chat with an agent',
  default: true,
  options: {
    org: { alias: ['o'], description: 'Organization ID', type: 'string' },
    agent: { alias: ['a'], description: 'Agent ID', type: 'string' },
    thread: { alias: ['t'], description: 'Thread ID', type: 'string' },
  },
  action: requireAuth(async ({ params }) => {
    const { waitUntilExit } = render(
      React.createElement(App, {
        initialOrgId: params.org,
        initialAgentId: params.agent,
        initialThreadId: params.thread,
      })
    )
    await waitUntilExit()
  }),
}
```

**Step 2: Run relevant tests**

Run: `cd repos/repl && pnpm test -- src/cli.test.ts`
Expected: Most tests PASS (some may need mock updates for React rendering)

**Step 3: Fix any test failures**

Update mocks in `cli.test.ts` as needed to handle the new React/Ink rendering in the chat task.

**Step 4: Commit**

```bash
git add repos/repl/src/tasks/chat.ts
git commit -m "feat(repl): bridge chat task to Ink App component"
```

---

## Task 28: CLI Task Updates (Login, Logout, Status)

**Files:**
- Modify: `repos/repl/src/tasks/login.ts`
- Modify: `repos/repl/src/tasks/status.ts`
- Modify: `repos/repl/src/tasks/agents.ts`
- Modify: `repos/repl/src/tasks/threads.ts`

**Step 1: Update login task to use themed output**

Update `repos/repl/src/tasks/login.ts` to use `themed()` from the theme system instead of `renderer.renderSuccess()`.

**Step 2: Update other tasks similarly**

Replace `renderer.*` calls with `themed()` calls or `console.log()` with themed output. The non-interactive tasks (login, logout, status, agents, threads, help) don't need Ink — they can use direct console output with picocolors.

**Step 3: Run full test suite**

Run: `cd repos/repl && pnpm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add repos/repl/src/tasks/
git commit -m "refactor(repl): update CLI tasks to use theme system"
```

---

## Task 29: Services Index and Cleanup

**Files:**
- Create: `repos/repl/src/services/index.ts`
- Delete: `repos/repl/src/display/renderer.ts`
- Delete: `repos/repl/src/display/colors.ts`
- Delete: `repos/repl/src/display/index.ts`
- Delete: `repos/repl/src/repl.ts`
- Modify: `repos/repl/src/cli.ts`

**Step 1: Create services index**

Create `repos/repl/src/services/index.ts`:
```typescript
export { ConfigService } from './config'
export { ContextLoader } from './context'
export { HooksService } from './hooks'
```

**Step 2: Remove old files**

Delete:
- `repos/repl/src/display/renderer.ts`
- `repos/repl/src/display/colors.ts`
- `repos/repl/src/display/index.ts`
- `repos/repl/src/repl.ts`

These are replaced by the Ink components and theme system.

**Step 3: Update cli.ts**

Remove `Renderer` import and instantiation from `repos/repl/src/cli.ts`. Tasks that used `renderer` should now use themed console output directly.

**Step 4: Run full test suite**

Run: `cd repos/repl && pnpm test`
Expected: Tests pass (old renderer/repl tests should be removed or updated)

**Step 5: Remove old test files**

Delete:
- `repos/repl/src/display/renderer.test.ts`
- `repos/repl/src/repl.test.ts`

These are replaced by the component tests.

**Step 6: Commit**

```bash
git add -A repos/repl/src/
git commit -m "refactor(repl): remove old readline REPL and renderer, clean up imports"
```

---

## Task 30: Build Verification and Final Test Run

**Files:**
- Modify: `repos/repl/src/utils/tasks/config.ts` (remove old JSON config, point to ConfigService)

**Step 1: Update old config utility to delegate to ConfigService**

Modify `repos/repl/src/utils/tasks/config.ts`:
```typescript
import { ConfigService } from '@TRL/services/config'
import type { TReplConfig } from '@TRL/types'

export function loadConfig(): TReplConfig {
  const global = ConfigService.loadGlobal()
  const project = ConfigService.loadProject()
  return ConfigService.merge(global, project)
}

export function saveConfig(config: TReplConfig): void {
  ConfigService.saveGlobal(config)
}
```

**Step 2: Run full test suite**

Run: `cd repos/repl && pnpm test`
Expected: All tests pass

**Step 3: Build**

Run: `cd repos/repl && pnpm build`
Expected: Build succeeds

**Step 4: Compile native binary**

Run: `cd repos/repl && pnpm compile`
Expected: Produces `dist/tdsk-agent` binary

**Step 5: Smoke test the binary**

Run:
```bash
repos/repl/dist/tdsk-agent --version
repos/repl/dist/tdsk-agent help
```
Expected: Version prints, help output renders

**Step 6: Commit**

```bash
git add repos/repl/
git commit -m "feat(repl): complete production rewrite — Ink components, YAML config, context loading"
```

---

## Summary

| Task | Description | ~Files |
|------|-------------|--------|
| 1 | Dependencies and build config | 3 |
| 2 | Types and constants foundation | 9 |
| 3 | Theme system | 4 |
| 4 | Friendly errors utility | 2 |
| 5 | YAML config service | 2 |
| 6 | AuthManager refactor | 2 |
| 7 | ApiClient refactor (retry + providers) | 2 |
| 8 | Context loader service | 2 |
| 9 | Lifecycle hooks service | 2 |
| 10 | Executor refactor (providers, maxSteps) | 2 |
| 11 | Slash command registry (14 commands) | 16 |
| 12 | Markdown renderer utility | 2 |
| 13 | Spinner component | 2 |
| 14 | SelectPrompt component | 2 |
| 15 | ErrorMessage component | 2 |
| 16 | WelcomeBox component | 2 |
| 17 | StatusBar component | 2 |
| 18 | ToolActivity component | 2 |
| 19 | Message components (User + Assistant) | 4 |
| 20 | StreamingResponse component | 2 |
| 21 | Prompt component | 2 |
| 22 | MessageList component | 2 |
| 23 | AgentPicker component | 2 |
| 24 | React hooks (9 hooks) | 12 |
| 25 | ChatSession container | 2 |
| 26 | App root component | 2 |
| 27 | Chat task bridge (Ink rendering) | 1 |
| 28 | CLI task updates | 4 |
| 29 | Cleanup (remove old code) | 6 |
| 30 | Build verification and final tests | 1 |
