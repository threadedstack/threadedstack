import type { ApiClient } from '@TSA/services/api'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveAgentId } from './resolveAgentId'

const makeAgent = (id: string, name: string, model?: string) => ({
  id,
  name,
  model,
})

const makeClient = (agents: any[] | null, error?: any) =>
  ({
    listAgents: vi.fn().mockResolvedValue({
      data: agents,
      ok: !error && !!agents,
      status: error ? 500 : 200,
      error: error ? { message: error } : undefined,
    }),
  }) as unknown as ApiClient

describe(`resolveAgentId`, () => {
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

  it(`returns explicit agent ID without API call`, async () => {
    const client = makeClient([])
    const result = await resolveAgentId(client, `org1`, `agent_explicit`)
    expect(result).toBe(`agent_explicit`)
    expect(client.listAgents).not.toHaveBeenCalled()
  })

  it(`auto-selects single agent`, async () => {
    const client = makeClient([makeAgent(`ag-1`, `Only Agent`, `claude-4`)])
    const result = await resolveAgentId(client, `org1`)
    expect(result).toBe(`ag-1`)
    const output = stdoutSpy.mock.calls.flat().join(``) as string
    expect(output).toContain(`Only Agent`)
  })

  it(`auto-selects single agent and falls back to id when no name`, async () => {
    const client = makeClient([makeAgent(`ag-nameless`, ``)])
    const result = await resolveAgentId(client, `org1`)
    expect(result).toBe(`ag-nameless`)
    const output = stdoutSpy.mock.calls.flat().join(``) as string
    expect(output).toContain(`ag-nameless`)
  })

  it(`returns config agent when it matches an agent in the list`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: false,
      writable: true,
      configurable: true,
    })
    const client = makeClient([
      makeAgent(`ag-1`, `Agent One`),
      makeAgent(`ag-2`, `Agent Two`),
    ])
    const result = await resolveAgentId(client, `org1`, undefined, `ag-2`)
    expect(result).toBe(`ag-2`)
  })

  it(`ignores stale config agent and throws in non-TTY`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: false,
      writable: true,
      configurable: true,
    })
    const client = makeClient([
      makeAgent(`ag-1`, `Agent One`),
      makeAgent(`ag-2`, `Agent Two`),
    ])
    await expect(
      resolveAgentId(client, `org1`, undefined, `stale-agent-id`)
    ).rejects.toThrow(`Multiple agents found. Use --agent <id> to specify.`)
  })

  it(`throws when no agents found`, async () => {
    const client = makeClient([])
    await expect(resolveAgentId(client, `org1`)).rejects.toThrow(
      `No agents found in this organization`
    )
  })

  it(`throws when multiple agents and non-TTY`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: false,
      writable: true,
      configurable: true,
    })
    const client = makeClient([
      makeAgent(`ag-1`, `Agent One`),
      makeAgent(`ag-2`, `Agent Two`),
    ])
    await expect(resolveAgentId(client, `org1`)).rejects.toThrow(
      `Multiple agents found. Use --agent <id> to specify.`
    )
  })

  it(`throws when API returns error`, async () => {
    const client = makeClient(null, `Internal server error`)
    await expect(resolveAgentId(client, `org1`)).rejects.toThrow(`Internal server error`)
  })

  it(`throws with generic message when API returns null data and no error`, async () => {
    const client = makeClient(null)
    await expect(resolveAgentId(client, `org1`)).rejects.toThrow(`Failed to list agents`)
  })
})
