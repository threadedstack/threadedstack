import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockOrgsGet = vi.fn()
const mockSetActiveOrgRole = vi.fn()
const mockSetActiveOrgResolvedPerms = vi.fn()

vi.mock(`@TTH/services/orgsApi`, () => ({
  orgsApi: { get: (...args: any[]) => mockOrgsGet(...args) },
}))

let currentOrgId: string | null = null

vi.mock(`@TTH/state/accessors`, () => ({
  getOrgId: () => currentOrgId,
  setActiveOrgRole: (...args: any[]) => mockSetActiveOrgRole(...args),
  setActiveOrgResolvedPerms: (...args: any[]) => mockSetActiveOrgResolvedPerms(...args),
}))

import { fetchOrg } from './fetchOrg'

describe(`fetchOrg`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentOrgId = null
  })

  it(`returns { error } immediately on a transport error, without touching state`, async () => {
    mockOrgsGet.mockResolvedValue({ error: { message: `boom` } })

    const result = await fetchOrg(`org-1`)

    expect(result).toEqual({ error: { message: `boom` } })
    expect(mockSetActiveOrgResolvedPerms).not.toHaveBeenCalled()
    expect(mockSetActiveOrgRole).not.toHaveBeenCalled()
  })

  it(`sets resolvedPermissions when it is a real TPermission[] array`, async () => {
    currentOrgId = `org-1`
    mockOrgsGet.mockResolvedValue({ data: { resolvedPermissions: [`org:read`] } })

    await fetchOrg(`org-1`)

    expect(mockSetActiveOrgResolvedPerms).toHaveBeenCalledWith([`org:read`])
  })

  it(`sets resolvedPermissions when it is the literal 'super'`, async () => {
    currentOrgId = `org-1`
    mockOrgsGet.mockResolvedValue({ data: { resolvedPermissions: `super` } })

    await fetchOrg(`org-1`)

    expect(mockSetActiveOrgResolvedPerms).toHaveBeenCalledWith(`super`)
  })

  it(`still commits an EMPTY resolvedPermissions array (defined-but-empty, not a truthiness check)`, async () => {
    currentOrgId = `org-1`
    mockOrgsGet.mockResolvedValue({ data: { resolvedPermissions: [] } })

    await fetchOrg(`org-1`)

    expect(mockSetActiveOrgResolvedPerms).toHaveBeenCalledWith([])
  })

  it(`does not call setActiveOrgResolvedPerms when resolvedPermissions is omitted`, async () => {
    currentOrgId = `org-1`
    mockOrgsGet.mockResolvedValue({ data: {} })

    await fetchOrg(`org-1`)

    expect(mockSetActiveOrgResolvedPerms).not.toHaveBeenCalled()
  })

  it(`sets the active org role when userRole is valid and the org is still the active one`, async () => {
    currentOrgId = `org-1`
    mockOrgsGet.mockResolvedValue({ data: { userRole: `admin` } })

    await fetchOrg(`org-1`)

    expect(mockSetActiveOrgRole).toHaveBeenCalledWith(`admin`)
  })

  it(`STALE-ORG GUARD: does not set the active org role when the active org has since changed`, async () => {
    currentOrgId = `org-2`
    mockOrgsGet.mockResolvedValue({ data: { userRole: `admin` } })

    await fetchOrg(`org-1`)

    expect(mockSetActiveOrgRole).not.toHaveBeenCalled()
  })

  it(`does not set the active org role when userRole fails isValidRoleType`, async () => {
    currentOrgId = `org-1`
    mockOrgsGet.mockResolvedValue({ data: { userRole: `not-a-role` } })

    await fetchOrg(`org-1`)

    expect(mockSetActiveOrgRole).not.toHaveBeenCalled()
  })

  it(`does not set the active org role when userRole is missing`, async () => {
    currentOrgId = `org-1`
    mockOrgsGet.mockResolvedValue({ data: {} })

    await fetchOrg(`org-1`)

    expect(mockSetActiveOrgRole).not.toHaveBeenCalled()
  })

  it(`returns the raw resp object unchanged on the non-error path`, async () => {
    currentOrgId = `org-1`
    const resp = { data: { userRole: `owner`, resolvedPermissions: [`org:read`] } }
    mockOrgsGet.mockResolvedValue(resp)

    const result = await fetchOrg(`org-1`)

    expect(result).toBe(resp)
  })
})
