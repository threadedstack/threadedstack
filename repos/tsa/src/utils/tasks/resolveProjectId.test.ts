import type { ApiClient } from '@TSA/services/api'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveProjectId } from './resolveProjectId'

const makeClient = (projects: { id: string; name: string }[] | null, error?: any) =>
  ({
    listProjects: vi.fn().mockResolvedValue({
      data: projects,
      ok: !error && !!projects,
      status: error ? 500 : 200,
      error: error ? { message: error } : undefined,
    }),
  }) as unknown as ApiClient

describe(`resolveProjectId`, () => {
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

  it(`returns explicit projectId when provided`, async () => {
    const client = makeClient([{ id: `p1`, name: `Proj1` }])
    const result = await resolveProjectId(client, `org1`, `explicit-proj`)
    expect(result).toBe(`explicit-proj`)
    expect(client.listProjects).not.toHaveBeenCalled()
  })

  it(`auto-selects when single project exists`, async () => {
    const client = makeClient([{ id: `p1`, name: `Only Project` }])
    const result = await resolveProjectId(client, `org1`)
    expect(result).toBe(`p1`)
    expect(client.listProjects).toHaveBeenCalledWith(`org1`)
  })

  it(`throws when no projects found`, async () => {
    const client = makeClient([])
    await expect(resolveProjectId(client, `org1`)).rejects.toThrow(
      `No projects found in this organization`
    )
  })

  it(`throws when API returns an error`, async () => {
    const client = makeClient(null, `Network error`)
    await expect(resolveProjectId(client, `org1`)).rejects.toThrow(`Network error`)
  })

  it(`throws when multiple projects and non-interactive`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: false,
      writable: true,
      configurable: true,
    })
    const client = makeClient([
      { id: `p1`, name: `Proj1` },
      { id: `p2`, name: `Proj2` },
    ])
    await expect(resolveProjectId(client, `org1`)).rejects.toThrow(
      `Multiple projects found. Use --project <id> to specify.`
    )
  })

  it(`throws when multiple projects and stdin is undefined (non-TTY)`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: undefined,
      writable: true,
      configurable: true,
    })
    const client = makeClient([
      { id: `p1`, name: `Proj1` },
      { id: `p2`, name: `Proj2` },
    ])
    await expect(resolveProjectId(client, `org1`)).rejects.toThrow(
      `Multiple projects found. Use --project <id> to specify.`
    )
  })
})
