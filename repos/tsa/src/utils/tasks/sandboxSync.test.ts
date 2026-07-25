import type { SyncManager } from '@TSA/services/sync/syncManager'
import type { ApiClient } from '@TSA/services/api'
import type { TSyncConfig } from '@tdsk/domain'
import { autoStartSync, stopSync } from './sandboxSync'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExistsSync = vi.fn()
const mockMergeRules = vi.fn()
const mockResolveSourcePath = vi.fn()

vi.mock(`fs`, async () => {
  const actual = await vi.importActual<typeof import('fs')>(`fs`)
  return {
    ...actual,
    existsSync: (...args: any[]) => mockExistsSync(...args),
  }
})

vi.mock(`@TSA/services/sync/configLoader`, () => ({
  mergeRules: (...args: any[]) => mockMergeRules(...args),
  resolveSourcePath: (...args: any[]) => mockResolveSourcePath(...args),
}))

const makeManager = () => ({ startAll: vi.fn(), stopAll: vi.fn() })

const makeCtx = (manager = makeManager(), started = false) => ({
  manager: manager as unknown as SyncManager,
  started,
})

const makeClient = (resp?: { data?: any; error?: any }) =>
  ({
    getSandbox: vi.fn().mockResolvedValue({ data: undefined, error: undefined, ...resp }),
  }) as unknown as ApiClient

describe(`autoStartSync`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveSourcePath.mockImplementation((source: string) => source)
    mockExistsSync.mockReturnValue(true)
    vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
    vi.spyOn(process.stderr, `write`).mockImplementation(() => true)
  })

  it(`no-ops when syncConfig.enabled is false`, async () => {
    const client = makeClient()

    await autoStartSync(
      makeCtx(),
      { enabled: false } as TSyncConfig,
      client,
      `org-1`,
      `sb-1`
    )

    expect(client.getSandbox).not.toHaveBeenCalled()
  })

  it(`no-ops when the per-sandbox override is disabled`, async () => {
    const client = makeClient()
    const syncConfig = {
      sandboxes: { 'sb-1': { enabled: false } },
    } as unknown as TSyncConfig

    await autoStartSync(makeCtx(), syncConfig, client, `org-1`, `sb-1`)

    expect(client.getSandbox).not.toHaveBeenCalled()
  })

  it(`writes a warning and continues when getSandbox returns an error`, async () => {
    const client = makeClient({ error: { message: `boom` } })
    const manager = makeManager()

    await autoStartSync(makeCtx(manager), undefined, client, `org-1`, `sb-1`)

    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining(`Could not fetch sandbox config for sync: boom`)
    )
    expect(manager.startAll).toHaveBeenCalled()
  })

  it(`injects a targetBase from the sandbox workdir when sync.targetBase is absent`, async () => {
    const client = makeClient({
      data: { config: { workdir: `/remote/work`, sync: { mode: `two-way-safe` } } },
    })
    const manager = makeManager()
    manager.startAll.mockResolvedValue([{ id: `s1` }])

    await autoStartSync(makeCtx(manager), undefined, client, `org-1`, `sb-1`)

    const rulesArg = manager.startAll.mock.calls[0][2]
    expect(rulesArg[0].target).toBe(`/remote/work`)
  })

  it(`calls mergeRules with syncConfig.rules, sandbox defaults, and per-sandbox overrides when rules are configured`, async () => {
    const client = makeClient({ data: { config: { workdir: `/remote/work` } } })
    const manager = makeManager()
    const rules = [{ name: `r1`, source: `./src` }]
    const overrides = [{ name: `r1`, source: `./override` }]
    const syncConfig = {
      rules,
      sandboxes: { 'sb-1': { rules: overrides } },
    } as unknown as TSyncConfig
    mockMergeRules.mockReturnValue([
      { name: `r1`, source: `/resolved/src`, target: `/t` },
    ])

    await autoStartSync(makeCtx(manager), syncConfig, client, `org-1`, `sb-1`)

    expect(mockMergeRules).toHaveBeenCalledWith(
      rules,
      { targetBase: `/remote/work` },
      overrides
    )
  })

  it(`builds a single default rule when no syncConfig.rules are provided`, async () => {
    const client = makeClient({ data: { config: { workdir: `/remote/work` } } })
    const manager = makeManager()
    manager.startAll.mockResolvedValue([])

    await autoStartSync(makeCtx(manager), undefined, client, `org-1`, `sb-1`)

    expect(mockMergeRules).not.toHaveBeenCalled()
    const rulesArg = manager.startAll.mock.calls[0][2]
    expect(rulesArg).toHaveLength(1)
    expect(rulesArg[0].name).toBe(`default`)
    expect(rulesArg[0].target).toBe(`/remote/work`)
  })

  it(`resolves each rule source via resolveSourcePath and filters out rules whose source does not exist`, async () => {
    const client = makeClient()
    const manager = makeManager()
    mockResolveSourcePath.mockImplementation((s: string) => `/resolved${s}`)
    mockExistsSync.mockReturnValue(false)

    await autoStartSync(makeCtx(manager), undefined, client, `org-1`, `sb-1`)

    expect(mockResolveSourcePath).toHaveBeenCalled()
    expect(mockExistsSync).toHaveBeenCalledWith(`/resolved${process.cwd()}`)
    expect(manager.startAll).not.toHaveBeenCalled()
  })

  it(`sets ctx.started and writes a success message when startAll resolves non-empty sessions`, async () => {
    const client = makeClient()
    const manager = makeManager()
    manager.startAll.mockResolvedValue([{ id: `s1` }, { id: `s2` }])
    const ctx = makeCtx(manager)

    await autoStartSync(ctx, undefined, client, `org-1`, `sb-1`)

    expect(ctx.started).toBe(true)
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining(`File sync started (2 rules)`)
    )
  })

  it(`does not set ctx.started when startAll resolves an empty session list`, async () => {
    const client = makeClient()
    const manager = makeManager()
    manager.startAll.mockResolvedValue([])
    const ctx = makeCtx(manager)

    await autoStartSync(ctx, undefined, client, `org-1`, `sb-1`)

    expect(ctx.started).toBe(false)
    expect(process.stdout.write).not.toHaveBeenCalled()
  })

  it(`re-throws auth errors raised by startAll`, async () => {
    const client = makeClient()
    const manager = makeManager()
    manager.startAll.mockRejectedValue(new Error(`Request failed (401)`))

    await expect(
      autoStartSync(makeCtx(manager), undefined, client, `org-1`, `sb-1`)
    ).rejects.toThrow(`(401)`)
  })

  it(`re-throws "Not logged in" errors raised by startAll`, async () => {
    const client = makeClient()
    const manager = makeManager()
    manager.startAll.mockRejectedValue(new Error(`Not logged in`))

    await expect(
      autoStartSync(makeCtx(manager), undefined, client, `org-1`, `sb-1`)
    ).rejects.toThrow(`Not logged in`)
  })

  it(`swallows non-auth errors raised by startAll and writes a warning`, async () => {
    const client = makeClient()
    const manager = makeManager()
    manager.startAll.mockRejectedValue(new Error(`network blip`))
    const ctx = makeCtx(manager)

    await autoStartSync(ctx, undefined, client, `org-1`, `sb-1`)

    expect(ctx.started).toBe(false)
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining(`Warning: auto-sync failed:`)
    )
  })
})

describe(`stopSync`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
    vi.spyOn(process.stderr, `write`).mockImplementation(() => true)
  })

  it(`no-ops when ctx.started is false`, async () => {
    const manager = makeManager()

    await stopSync(makeCtx(manager, false), `sb-1`)

    expect(manager.stopAll).not.toHaveBeenCalled()
  })

  it(`stops sync sessions and writes a message when ctx.started is true`, async () => {
    const manager = makeManager()
    manager.stopAll.mockResolvedValue(undefined)

    await stopSync(makeCtx(manager, true), `sb-1`, `inst-1`)

    expect(manager.stopAll).toHaveBeenCalledWith(`sb-1`, `inst-1`)
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining(`File sync stopped`)
    )
  })

  it(`writes a warning and does not throw when stopAll rejects`, async () => {
    const manager = makeManager()
    manager.stopAll.mockRejectedValue(new Error(`daemon gone`))

    await expect(stopSync(makeCtx(manager, true), `sb-1`)).resolves.toBeUndefined()

    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining(`Warning: could not stop sync sessions`)
    )
  })
})
