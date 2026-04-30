import type { ApiClient } from '@TSA/services/api'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveOrgId } from './resolveOrgId'

const makeClient = (orgs: { id: string; name: string }[] | null, error?: string) =>
  ({
    listOrgs: vi.fn().mockResolvedValue({
      data: orgs,
      ok: !error && !!orgs,
      status: error ? 500 : 200,
      error: error ? { message: error } : undefined,
    }),
  }) as unknown as ApiClient

describe('resolveOrgId', () => {
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
    vi.restoreAllMocks()
  })

  const setTTY = (value: boolean | undefined) => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value,
      writable: true,
      configurable: true,
    })
  }

  it('returns explicit orgId without making an API call', async () => {
    const client = makeClient([{ id: 'org-1', name: 'Org One' }])
    const result = await resolveOrgId(client, 'explicit-org-id')
    expect(result).toBe('explicit-org-id')
    expect(client.listOrgs).not.toHaveBeenCalled()
  })

  it('auto-selects when only one org exists', async () => {
    const client = makeClient([{ id: 'org-1', name: 'Org One' }])
    const result = await resolveOrgId(client)
    expect(result).toBe('org-1')
  })

  it('returns configOrgId when it matches an org in the list', async () => {
    const client = makeClient([
      { id: 'org-1', name: 'Org One' },
      { id: 'org-2', name: 'Org Two' },
    ])
    setTTY(false)
    const result = await resolveOrgId(client, undefined, 'org-2')
    expect(result).toBe('org-2')
  })

  it('ignores stale configOrgId (not in list) and throws in non-TTY', async () => {
    const client = makeClient([
      { id: 'org-1', name: 'Org One' },
      { id: 'org-2', name: 'Org Two' },
    ])
    setTTY(false)
    await expect(resolveOrgId(client, undefined, 'stale-org-id')).rejects.toThrow(
      'Multiple orgs found. Use --org <id> to specify.'
    )
  })

  it('throws when no orgs are found', async () => {
    const client = makeClient([])
    await expect(resolveOrgId(client)).rejects.toThrow('No organizations found')
  })

  it('throws when API returns an error', async () => {
    const client = makeClient(null, 'Internal server error')
    await expect(resolveOrgId(client)).rejects.toThrow('Internal server error')
  })

  it('throws when API returns neither data nor error', async () => {
    const client = makeClient(null)
    await expect(resolveOrgId(client)).rejects.toThrow('Failed to list organizations')
  })

  it('throws when multiple orgs exist and stdin is not a TTY', async () => {
    const client = makeClient([
      { id: 'org-1', name: 'Org One' },
      { id: 'org-2', name: 'Org Two' },
    ])
    setTTY(false)
    await expect(resolveOrgId(client)).rejects.toThrow(
      'Multiple orgs found. Use --org <id> to specify.'
    )
  })
})
