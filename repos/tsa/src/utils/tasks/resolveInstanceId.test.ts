import type { ApiClient } from '@TSA/services/api'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveInstanceId } from './resolveInstanceId'

const makeInstance = (instanceId: string, state = `running`, sessions: any[] = []) => ({
  instanceId,
  state,
  userId: `user-1`,
  sandboxId: `sb-1`,
  sessions,
})

const makeClient = (instances: any[] | null, maxInstances = 4, error?: string) =>
  ({
    listInstances: vi.fn().mockResolvedValue({
      data: instances ? { maxInstances, instances } : null,
      ok: !error && !!instances,
      status: error ? 500 : 200,
      error: error ? { message: error } : undefined,
    }),
  }) as unknown as ApiClient

describe(`resolveInstanceId`, () => {
  let originalIsTTY: boolean | undefined
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY
    stdoutSpy = vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, `write`).mockImplementation(() => true)
  })

  afterEach(() => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it(`returns newInstance when forceNew is true without calling listInstances`, async () => {
    const client = makeClient([])
    const result = await resolveInstanceId(client, `org1`, `proj1`, `sb-1`, {
      forceNew: true,
    })
    expect(result).toEqual({ newInstance: true })
    expect(client.listInstances).not.toHaveBeenCalled()
  })

  it(`throws when API returns error and explicit instance is set`, async () => {
    const client = makeClient(null, 4, `Internal server error`)
    await expect(
      resolveInstanceId(client, `org1`, `proj1`, `sb-1`, {
        explicitInstance: `abc123`,
      })
    ).rejects.toThrow(`Internal server error`)
  })

  it(`returns empty object and writes warning to stderr when API errors without explicit instance`, async () => {
    const client = makeClient(null, 4, `Connection refused`)
    const result = await resolveInstanceId(client, `org1`, `proj1`, `sb-1`)
    expect(result).toEqual({})
    const output = stderrSpy.mock.calls.flat().join(``) as string
    expect(output).toContain(`Could not list instances`)
  })

  it(`returns instanceId for an exact match on explicit instance`, async () => {
    const inst = makeInstance(`inst-full-exact-id-abc123`)
    const client = makeClient([inst])
    const result = await resolveInstanceId(client, `org1`, `proj1`, `sb-1`, {
      explicitInstance: `inst-full-exact-id-abc123`,
    })
    expect(result).toEqual({ instanceId: `inst-full-exact-id-abc123` })
  })

  it(`returns instanceId for a unique suffix match on explicit instance`, async () => {
    const inst = makeInstance(`inst-prefix-unique-suffix`)
    const client = makeClient([inst])
    const result = await resolveInstanceId(client, `org1`, `proj1`, `sb-1`, {
      explicitInstance: `unique-suffix`,
    })
    expect(result).toEqual({ instanceId: `inst-prefix-unique-suffix` })
  })

  it(`throws when explicit instance suffix matches multiple instances`, async () => {
    const inst1 = makeInstance(`inst-aaa-shared-suffix`)
    const inst2 = makeInstance(`inst-bbb-shared-suffix`)
    const client = makeClient([inst1, inst2])
    let error: Error | undefined
    try {
      await resolveInstanceId(client, `org1`, `proj1`, `sb-1`, {
        explicitInstance: `shared-suffix`,
      })
    } catch (err) {
      error = err as Error
    }
    expect(error).toBeDefined()
    expect(error!.message).toMatch(/Ambiguous/)
    expect(error!.message).toContain(`inst-aaa-shared-suffix`)
    expect(error!.message).toContain(`inst-bbb-shared-suffix`)
  })

  it(`throws when explicit instance matches nothing`, async () => {
    const inst = makeInstance(`inst-existing-one`)
    const client = makeClient([inst])
    await expect(
      resolveInstanceId(client, `org1`, `proj1`, `sb-1`, {
        explicitInstance: `nonexistent`,
      })
    ).rejects.toThrow(`No running instance matching "nonexistent"`)
  })

  it(`returns empty object when no instances and no explicit instance`, async () => {
    const client = makeClient([])
    const result = await resolveInstanceId(client, `org1`, `proj1`, `sb-1`)
    expect(result).toEqual({})
  })

  it(`auto-selects single instance and writes to stdout`, async () => {
    const inst = makeInstance(`inst-abcdef123456`)
    const client = makeClient([inst])
    const result = await resolveInstanceId(client, `org1`, `proj1`, `sb-1`)
    expect(result).toEqual({ instanceId: `inst-abcdef123456` })
    expect(stdoutSpy).toHaveBeenCalled()
    const output = stdoutSpy.mock.calls.flat().join(``) as string
    expect(output).toContain(`inst-abcdef123456`.slice(-12))
  })

  it(`throws when multiple instances and non-TTY`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: false,
      writable: true,
      configurable: true,
    })
    const client = makeClient([makeInstance(`inst-one`), makeInstance(`inst-two`)])
    await expect(resolveInstanceId(client, `org1`, `proj1`, `sb-1`)).rejects.toThrow(
      `Multiple instances running. Use --instance <id> to specify or --new to start a new one.`
    )
  })
})
