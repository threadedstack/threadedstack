import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest } from '@TBE/types'
import type { TOverrideEntry } from '@tdsk/domain'
import { ERoleType, EPermAction, EPermResource } from '@tdsk/domain'

import { validateOverrides } from './validateOverrides'

const mockResolveEffectivePermissions = vi.hoisted(() => vi.fn())
vi.mock(`@TBE/utils/auth/resolveEffectivePermissions`, () => ({
  resolveEffectivePermissions: mockResolveEffectivePermissions,
}))

describe(`validateOverrides`, () => {
  const validPermission = `${EPermResource.project}:${EPermAction.read}` as const
  const otherPermission = `${EPermResource.secret}:${EPermAction.manage}` as const

  const buildReq = () => ({ user: { id: `test-user-id` } }) as unknown as TRequest

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`does not resolve caller permissions when every override is a deny`, async () => {
    const overrides: TOverrideEntry[] = [{ permission: validPermission, effect: `deny` }]

    await expect(
      validateOverrides(overrides, buildReq(), `org-1`)
    ).resolves.toBeUndefined()
    expect(mockResolveEffectivePermissions).not.toHaveBeenCalled()
  })

  it(`throws 400 for an invalid permission string`, async () => {
    const overrides: TOverrideEntry[] = [
      { permission: `not-a-permission` as any, effect: `deny` },
    ]

    await expect(validateOverrides(overrides, buildReq(), `org-1`)).rejects.toMatchObject(
      {
        status: 400,
        message: `Invalid permission: not-a-permission`,
      }
    )
  })

  it(`throws 400 for an invalid effect`, async () => {
    const overrides: TOverrideEntry[] = [
      { permission: validPermission, effect: `allow` as any },
    ]

    await expect(validateOverrides(overrides, buildReq(), `org-1`)).rejects.toMatchObject(
      {
        status: 400,
        message: `Invalid effect: allow. Must be 'grant' or 'deny'`,
      }
    )
  })

  it(`throws 500 when resolving caller permissions fails to yield a set`, async () => {
    mockResolveEffectivePermissions.mockResolvedValue(null)
    const overrides: TOverrideEntry[] = [{ permission: validPermission, effect: `grant` }]

    await expect(validateOverrides(overrides, buildReq(), `org-1`)).rejects.toMatchObject(
      {
        status: 500,
        message: `Failed to resolve caller permissions`,
      }
    )
  })

  it(`throws 403 when granting a permission the caller does not hold`, async () => {
    mockResolveEffectivePermissions.mockResolvedValue(new Set([otherPermission]))
    const overrides: TOverrideEntry[] = [{ permission: validPermission, effect: `grant` }]

    await expect(validateOverrides(overrides, buildReq(), `org-1`)).rejects.toMatchObject(
      {
        status: 403,
        code: `FORBIDDEN`,
        message: `Cannot grant a permission you do not have: ${validPermission}`,
      }
    )
  })

  it(`allows granting a permission the caller holds`, async () => {
    mockResolveEffectivePermissions.mockResolvedValue(new Set([validPermission]))
    const overrides: TOverrideEntry[] = [{ permission: validPermission, effect: `grant` }]

    await expect(
      validateOverrides(overrides, buildReq(), `org-1`)
    ).resolves.toBeUndefined()
  })

  it(`bypasses the caller-permission check for a super admin`, async () => {
    mockResolveEffectivePermissions.mockResolvedValue(ERoleType.super)
    const overrides: TOverrideEntry[] = [{ permission: validPermission, effect: `grant` }]

    await expect(
      validateOverrides(overrides, buildReq(), `org-1`)
    ).resolves.toBeUndefined()
  })

  it(`validates every override in a mixed grant/deny list`, async () => {
    mockResolveEffectivePermissions.mockResolvedValue(new Set([validPermission]))
    const overrides: TOverrideEntry[] = [
      { permission: validPermission, effect: `grant` },
      { permission: otherPermission, effect: `deny` },
    ]

    await expect(
      validateOverrides(overrides, buildReq(), `org-1`)
    ).resolves.toBeUndefined()
    expect(mockResolveEffectivePermissions).toHaveBeenCalledTimes(1)
  })

  it(`rejects a grant as soon as an earlier override is invalid, before checking caller permissions for it`, async () => {
    const overrides: TOverrideEntry[] = [
      { permission: `bad:perm` as any, effect: `grant` },
      { permission: validPermission, effect: `grant` },
    ]

    await expect(validateOverrides(overrides, buildReq(), `org-1`)).rejects.toMatchObject(
      {
        status: 400,
        message: `Invalid permission: bad:perm`,
      }
    )
  })
})
