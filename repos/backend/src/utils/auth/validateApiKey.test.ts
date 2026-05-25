import type { TPermission } from '@tdsk/domain'

import { describe, it, expect } from 'vitest'
import { ERoleType, buildRolePermissions } from '@tdsk/domain'
import { validateApiKeyPermissions, validateProjectKeyPermission } from './validateApiKey'

describe(`validateApiKeyPermissions`, () => {
  it(`should allow when all requested permissions are in the target set`, () => {
    const targetPerms = new Set<TPermission>([`org:read`, `project:read`, `sandbox:exec`])
    const result = validateApiKeyPermissions([`org:read`, `sandbox:exec`], targetPerms)
    expect(result.valid).toBe(true)
  })

  it(`should reject when a requested permission is not in the target set`, () => {
    const targetPerms = new Set<TPermission>([`org:read`, `project:read`])
    const result = validateApiKeyPermissions([`org:read`, `org:delete`], targetPerms)
    expect(result.valid).toBe(false)
    expect(result.error).toContain(`org:delete`)
    expect(result.invalidPermissions).toEqual([`org:delete`])
  })

  it(`should return valid for empty requested permissions`, () => {
    const targetPerms = new Set<TPermission>([`org:read`])
    const result = validateApiKeyPermissions([], targetPerms)
    expect(result.valid).toBe(true)
  })

  it(`should reject all permissions when target set is empty`, () => {
    const targetPerms = new Set<TPermission>()
    const result = validateApiKeyPermissions([`org:read`], targetPerms)
    expect(result.valid).toBe(false)
  })

  it(`should list multiple invalid permissions`, () => {
    const targetPerms = new Set<TPermission>([`org:read`])
    const result = validateApiKeyPermissions(
      [`org:delete`, `sandbox:manage`],
      targetPerms
    )
    expect(result.valid).toBe(false)
    expect(result.invalidPermissions).toHaveLength(2)
  })
})

describe(`validateProjectKeyPermission`, () => {
  const adminPerms = new Set<TPermission>(buildRolePermissions(ERoleType.admin))
  const memberPerms = new Set<TPermission>(buildRolePermissions(ERoleType.member))

  it(`should allow self-creation with valid permissions`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.admin,
      requesterUserId: `user-1`,
      targetUserId: `user-1`,
      isOrgAdmin: false,
      requestedPermissions: [`org:read`],
      targetUserPermissions: adminPerms,
    })
    expect(result.valid).toBe(true)
  })

  it(`should reject self-creation with permissions not in target set`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.member,
      requesterUserId: `user-1`,
      targetUserId: `user-1`,
      isOrgAdmin: false,
      requestedPermissions: [`org:delete`],
      targetUserPermissions: memberPerms,
    })
    expect(result.valid).toBe(false)
  })

  it(`should allow org admin to create key for other user`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.member,
      requesterUserId: `user-1`,
      targetUserId: `user-2`,
      isOrgAdmin: true,
      requestedPermissions: [`org:read`],
      targetUserPermissions: memberPerms,
    })
    expect(result.valid).toBe(true)
  })

  it(`should reject non-admin creating key for other user`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.member,
      requesterUserId: `user-1`,
      targetUserId: `user-2`,
      isOrgAdmin: false,
      requestedPermissions: [`org:read`],
      targetUserPermissions: memberPerms,
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain(`Only project admins`)
  })

  it(`should allow project admin to create key for other user`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.admin,
      requesterUserId: `user-1`,
      targetUserId: `user-2`,
      isOrgAdmin: false,
      requestedPermissions: [`org:read`],
      targetUserPermissions: adminPerms,
    })
    expect(result.valid).toBe(true)
  })

  it(`should reject when requested permissions exceed target user permissions`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.admin,
      requesterUserId: `user-1`,
      targetUserId: `user-2`,
      isOrgAdmin: true,
      requestedPermissions: [`org:delete`],
      targetUserPermissions: memberPerms,
    })
    expect(result.valid).toBe(false)
  })
})
