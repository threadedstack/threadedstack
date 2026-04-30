import type { ApiClient } from '@TSA/services/api'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY
    stdoutSpy = vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
  })

  afterEach(() => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it(`short-circuits for sb_ prefixed IDs without API call`, async () => {
    const client = makeClient([])
    const result = await resolveSandboxId(client, `org1`, `proj1`, `sb_direct123`)
    expect(result).toBe(`sb_direct123`)
    expect(client.listSandboxes).not.toHaveBeenCalled()
  })

  it(`returns explicit sandbox by ID match when not sb_ prefixed`, async () => {
    const sb1 = makeSandbox(`sb-1`, `Sandbox One`)
    const sb2 = makeSandbox(`sb-2`, `Sandbox Two`)
    const client = makeClient([sb1, sb2])
    const result = await resolveSandboxId(client, `org1`, `proj1`, `sb-1`)
    expect(result).toBe(`sb-1`)
    expect(client.listSandboxes).toHaveBeenCalledWith(`org1`, `proj1`)
  })

  it(`resolves alias to sandbox ID for active project`, async () => {
    const sb1 = makeSandbox(`sb-1`, `Sandbox One`, `my-alias`, `proj1`)
    const sb2 = makeSandbox(`sb-2`, `Sandbox Two`)
    const client = makeClient([sb1, sb2])
    const result = await resolveSandboxId(client, `org1`, `proj1`, `my-alias`)
    expect(result).toBe(`sb-1`)
  })

  it(`does NOT resolve alias from a different project`, async () => {
    // sandbox has alias for proj2, but we're resolving under proj1
    const sb = makeSandbox(`sb-1`, `Sandbox One`, `shared-alias`, `proj2`)
    const client = makeClient([sb])
    // single sandbox — auto-selects, ignores alias resolution for explicit input
    // but we pass the alias as explicitSandboxId: it won't match by ID, and alias lookup
    // filters by proj1 (not proj2), so it should throw
    const clientMulti = makeClient([
      sb,
      makeSandbox(`sb-2`, `Sandbox Two`, undefined, `proj1`),
    ])
    await expect(
      resolveSandboxId(clientMulti, `org1`, `proj1`, `shared-alias`)
    ).rejects.toThrow(`Sandbox not found: shared-alias`)
  })

  it(`throws when explicit value matches nothing`, async () => {
    const sb1 = makeSandbox(`sb-1`, `Sandbox One`)
    const client = makeClient([sb1])
    await expect(
      resolveSandboxId(client, `org1`, `proj1`, `nonexistent`)
    ).rejects.toThrow(`Sandbox not found: nonexistent`)
  })

  it(`auto-selects and writes message when single sandbox exists`, async () => {
    const sb = makeSandbox(`sb-1`, `Only Sandbox`)
    const client = makeClient([sb])
    const result = await resolveSandboxId(client, `org1`, `proj1`)
    expect(result).toBe(`sb-1`)
    expect(stdoutSpy).toHaveBeenCalled()
    const output = stdoutSpy.mock.calls.flat().join(``) as string
    expect(output).toContain(`Only Sandbox`)
  })

  it(`auto-selects by sandbox name when single sandbox exists (uses id fallback when no name)`, async () => {
    const sb = makeSandbox(`sb-nameless`, ``)
    // override name to empty to test id fallback
    sb.name = ``
    const client = makeClient([sb])
    const result = await resolveSandboxId(client, `org1`, `proj1`)
    expect(result).toBe(`sb-nameless`)
    const output = stdoutSpy.mock.calls.flat().join(``) as string
    expect(output).toContain(`sb-nameless`)
  })

  it(`returns configSandboxId when it matches a sandbox in the list`, async () => {
    const sb1 = makeSandbox(`sb-1`, `Sandbox One`)
    const sb2 = makeSandbox(`sb-2`, `Sandbox Two`)
    Object.defineProperty(process.stdin, `isTTY`, {
      value: false,
      writable: true,
      configurable: true,
    })
    const client = makeClient([sb1, sb2])
    const result = await resolveSandboxId(client, `org1`, `proj1`, undefined, `sb-2`)
    expect(result).toBe(`sb-2`)
  })

  it(`ignores stale configSandboxId and throws in non-TTY`, async () => {
    const sb1 = makeSandbox(`sb-1`, `Sandbox One`)
    const sb2 = makeSandbox(`sb-2`, `Sandbox Two`)
    Object.defineProperty(process.stdin, `isTTY`, {
      value: false,
      writable: true,
      configurable: true,
    })
    const client = makeClient([sb1, sb2])
    await expect(
      resolveSandboxId(client, `org1`, `proj1`, undefined, `stale-sb-id`)
    ).rejects.toThrow(`Multiple sandboxes found. Use --sandbox <id> to specify.`)
  })

  it(`throws when no sandboxes found`, async () => {
    const client = makeClient([])
    await expect(resolveSandboxId(client, `org1`, `proj1`)).rejects.toThrow(
      `No sandboxes found in this project`
    )
  })

  it(`throws when multiple sandboxes and non-TTY`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: false,
      writable: true,
      configurable: true,
    })
    const client = makeClient([
      makeSandbox(`sb-1`, `Sandbox One`),
      makeSandbox(`sb-2`, `Sandbox Two`),
    ])
    await expect(resolveSandboxId(client, `org1`, `proj1`)).rejects.toThrow(
      `Multiple sandboxes found. Use --sandbox <id> to specify.`
    )
  })

  it(`throws when API returns error`, async () => {
    const client = makeClient(null, `Internal server error`)
    await expect(resolveSandboxId(client, `org1`, `proj1`)).rejects.toThrow(
      `Internal server error`
    )
  })

  it(`throws with generic message when API returns null data and no error`, async () => {
    const client = makeClient(null)
    await expect(resolveSandboxId(client, `org1`, `proj1`)).rejects.toThrow(
      `Failed to list sandboxes`
    )
  })
})
