import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ERoleType, EPermResource } from '@tdsk/domain'
import { usePermissions } from './usePermissions'

describe(`usePermissions`, () => {
  describe(`null role`, () => {
    it(`should return null role`, () => {
      const { result } = renderHook(() => usePermissions(null))
      expect(result.current.role).toBeNull()
    })

    it(`should have all is* booleans as false`, () => {
      const { result } = renderHook(() => usePermissions(null))
      expect(result.current.isSuper).toBe(false)
      expect(result.current.isOwner).toBe(false)
      expect(result.current.isAdmin).toBe(false)
      expect(result.current.isMember).toBe(false)
    })

    it(`should deny all action checks`, () => {
      const { result } = renderHook(() => usePermissions(null))
      expect(result.current.canRead(EPermResource.org)).toBe(false)
      expect(result.current.canCreate(EPermResource.org)).toBe(false)
      expect(result.current.canUpdate(EPermResource.org)).toBe(false)
      expect(result.current.canDelete(EPermResource.org)).toBe(false)
      expect(result.current.canExec(EPermResource.sandbox)).toBe(false)
      expect(result.current.canManage(EPermResource.org)).toBe(false)
      expect(result.current.canConnect(EPermResource.sandbox)).toBe(false)
    })

    it(`should deny all convenience booleans`, () => {
      const { result } = renderHook(() => usePermissions(null))
      expect(result.current.canDeleteOrg).toBe(false)
      expect(result.current.canAccessSecretValues).toBe(false)
      expect(result.current.canInviteUsers).toBe(false)
      expect(result.current.canManageMembers).toBe(false)
      expect(result.current.canManageApiKeys).toBe(false)
    })

    it(`should deny canAssignRole for any target`, () => {
      const { result } = renderHook(() => usePermissions(null))
      expect(result.current.canAssignRole(ERoleType.member)).toBe(false)
    })

    it(`should have empty permissions set`, () => {
      const { result } = renderHook(() => usePermissions(null))
      expect(result.current.permissions.size).toBe(0)
    })

    it(`should deny has() for any permission`, () => {
      const { result } = renderHook(() => usePermissions(null))
      expect(result.current.has('org:read')).toBe(false)
    })
  })

  describe(`member role`, () => {
    it(`should have isMember true and higher roles false`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.isMember).toBe(true)
      expect(result.current.isAdmin).toBe(false)
      expect(result.current.isOwner).toBe(false)
      expect(result.current.isSuper).toBe(false)
    })

    it(`should allow exec on sandbox (sandbox.exec requires member)`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.canExec(EPermResource.sandbox)).toBe(true)
    })

    it(`should allow connect on sandbox (sandbox.connect requires member)`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.canConnect(EPermResource.sandbox)).toBe(true)
    })

    it(`should deny creating sandbox (sandbox.create requires admin)`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.canCreate(EPermResource.sandbox)).toBe(false)
    })

    it(`should allow creating agents (agent.create requires member)`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.canCreate(EPermResource.agent)).toBe(true)
    })

    it(`should deny secret value access`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.canAccessSecretValues).toBe(false)
    })

    it(`should deny managing members`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.canManageMembers).toBe(false)
    })

    it(`should have non-empty permissions set`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.permissions.size).toBeGreaterThan(0)
    })

    it(`should return true from has() for member permissions`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.has('org:read')).toBe(true)
      expect(result.current.has('sandbox:exec')).toBe(true)
    })

    it(`should return false from has() for admin permissions`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.has('sandbox:create')).toBe(false)
      expect(result.current.has('secret:manage')).toBe(false)
    })
  })

  describe(`admin role`, () => {
    it(`should have isAdmin true`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.admin))
      expect(result.current.isMember).toBe(true)
      expect(result.current.isAdmin).toBe(true)
      expect(result.current.isOwner).toBe(false)
      expect(result.current.isSuper).toBe(false)
    })

    it(`should allow creating secrets (secret.create requires admin)`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.admin))
      expect(result.current.canCreate(EPermResource.secret)).toBe(true)
    })

    it(`should deny deleting org (org.delete requires owner)`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.admin))
      expect(result.current.canDelete(EPermResource.org)).toBe(false)
      expect(result.current.canDeleteOrg).toBe(false)
    })

    it(`should allow secret value access`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.admin))
      expect(result.current.canAccessSecretValues).toBe(true)
    })

    it(`should allow managing members`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.admin))
      expect(result.current.canManageMembers).toBe(true)
    })

    it(`should allow inviting users`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.admin))
      expect(result.current.canInviteUsers).toBe(true)
    })

    it(`should allow managing API keys`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.admin))
      expect(result.current.canManageApiKeys).toBe(true)
    })
  })

  describe(`owner role`, () => {
    it(`should have isOwner true`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.owner))
      expect(result.current.isMember).toBe(true)
      expect(result.current.isAdmin).toBe(true)
      expect(result.current.isOwner).toBe(true)
      expect(result.current.isSuper).toBe(false)
    })

    it(`should allow deleting org`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.owner))
      expect(result.current.canDelete(EPermResource.org)).toBe(true)
      expect(result.current.canDeleteOrg).toBe(true)
    })

    it(`should inherit all admin permissions`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.owner))
      expect(result.current.canCreate(EPermResource.secret)).toBe(true)
      expect(result.current.canAccessSecretValues).toBe(true)
      expect(result.current.canManageMembers).toBe(true)
      expect(result.current.canInviteUsers).toBe(true)
    })
  })

  describe(`super role`, () => {
    it(`should have isSuper true and all is* booleans true`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.super))
      expect(result.current.isSuper).toBe(true)
      expect(result.current.isOwner).toBe(true)
      expect(result.current.isAdmin).toBe(true)
      expect(result.current.isMember).toBe(true)
    })

    it(`should allow all action checks`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.super))
      expect(result.current.canRead(EPermResource.org)).toBe(true)
      expect(result.current.canCreate(EPermResource.org)).toBe(true)
      expect(result.current.canUpdate(EPermResource.org)).toBe(true)
      expect(result.current.canDelete(EPermResource.org)).toBe(true)
      expect(result.current.canExec(EPermResource.sandbox)).toBe(true)
      expect(result.current.canManage(EPermResource.org)).toBe(true)
      expect(result.current.canConnect(EPermResource.sandbox)).toBe(true)
    })

    it(`should allow all convenience booleans`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.super))
      expect(result.current.canDeleteOrg).toBe(true)
      expect(result.current.canAccessSecretValues).toBe(true)
      expect(result.current.canInviteUsers).toBe(true)
      expect(result.current.canManageMembers).toBe(true)
      expect(result.current.canManageApiKeys).toBe(true)
    })

    it(`should return true from has() for any permission`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.super))
      expect(result.current.has('org:delete')).toBe(true)
      expect(result.current.has('sandbox:connect')).toBe(true)
    })
  })

  describe(`canAssignRole`, () => {
    it(`should allow admin to assign member`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.admin))
      expect(result.current.canAssignRole(ERoleType.member)).toBe(true)
    })

    it(`should deny admin assigning admin (same level)`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.admin))
      expect(result.current.canAssignRole(ERoleType.admin)).toBe(false)
    })

    it(`should allow owner to assign admin`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.owner))
      expect(result.current.canAssignRole(ERoleType.admin)).toBe(true)
    })

    it(`should deny owner assigning owner (same level)`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.owner))
      expect(result.current.canAssignRole(ERoleType.owner)).toBe(false)
    })

    it(`should allow super to assign any role`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.super))
      expect(result.current.canAssignRole(ERoleType.member)).toBe(true)
      expect(result.current.canAssignRole(ERoleType.admin)).toBe(true)
      expect(result.current.canAssignRole(ERoleType.owner)).toBe(true)
    })

    it(`should deny member assigning member (same level)`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.canAssignRole(ERoleType.member)).toBe(false)
    })
  })

  describe(`convenience booleans`, () => {
    it(`canAccessSecretValues should be true for admin and above`, () => {
      const admin = renderHook(() => usePermissions(ERoleType.admin))
      const member = renderHook(() => usePermissions(ERoleType.member))
      const owner = renderHook(() => usePermissions(ERoleType.owner))

      expect(admin.result.current.canAccessSecretValues).toBe(true)
      expect(member.result.current.canAccessSecretValues).toBe(false)
      expect(owner.result.current.canAccessSecretValues).toBe(true)
    })

    it(`canManageMembers should be true for admin and above`, () => {
      const admin = renderHook(() => usePermissions(ERoleType.admin))
      const member = renderHook(() => usePermissions(ERoleType.member))

      expect(admin.result.current.canManageMembers).toBe(true)
      expect(member.result.current.canManageMembers).toBe(false)
    })

    it(`canInviteUsers should be true for admin and above`, () => {
      const admin = renderHook(() => usePermissions(ERoleType.admin))
      const member = renderHook(() => usePermissions(ERoleType.member))

      expect(admin.result.current.canInviteUsers).toBe(true)
      expect(member.result.current.canInviteUsers).toBe(false)
    })

    it(`canManageApiKeys should be true for admin and above`, () => {
      const admin = renderHook(() => usePermissions(ERoleType.admin))
      const member = renderHook(() => usePermissions(ERoleType.member))

      expect(admin.result.current.canManageApiKeys).toBe(true)
      expect(member.result.current.canManageApiKeys).toBe(false)
    })
  })

  describe(`serverPermissions parameter`, () => {
    it(`should use serverPermissions array directly instead of computing from role`, () => {
      const serverPermissions = [`sandbox:exec`, `sandbox:read`] as const
      // member does not normally have secret:create; if serverPermissions is used, it controls
      const { result } = renderHook(() =>
        usePermissions(ERoleType.member, undefined, serverPermissions as any)
      )
      expect(result.current.has(`sandbox:exec`)).toBe(true)
      expect(result.current.has(`sandbox:read`)).toBe(true)
      // org:read is in member template but NOT in serverPermissions — so it should be absent
      expect(result.current.has(`org:read`)).toBe(false)
    })

    it(`should populate permissions set from serverPermissions array`, () => {
      const serverPermissions = [`project:read`, `agent:exec`] as const
      const { result } = renderHook(() =>
        usePermissions(ERoleType.member, undefined, serverPermissions as any)
      )
      expect(result.current.permissions.has(`project:read`)).toBe(true)
      expect(result.current.permissions.has(`agent:exec`)).toBe(true)
      expect(result.current.permissions.size).toBe(2)
    })

    it(`should allow granting permissions not in the role template via serverPermissions`, () => {
      // member does not normally have secret:create
      const serverPermissions = [`secret:create`] as const
      const { result } = renderHook(() =>
        usePermissions(ERoleType.member, undefined, serverPermissions as any)
      )
      expect(result.current.has(`secret:create`)).toBe(true)
      expect(result.current.canCreate(EPermResource.secret)).toBe(true)
    })

    it(`should return true from has() for any permission when serverPermissions is 'super'`, () => {
      const { result } = renderHook(() =>
        usePermissions(ERoleType.member, undefined, ERoleType.super)
      )
      expect(result.current.has(`org:delete`)).toBe(true)
      expect(result.current.has(`sandbox:manage`)).toBe(true)
      expect(result.current.has(`secret:manage`)).toBe(true)
    })

    it(`should populate permissions set when serverPermissions is 'super'`, () => {
      const { result } = renderHook(() =>
        usePermissions(ERoleType.admin, undefined, ERoleType.super)
      )
      // super path uses owner template perms as the set (not empty)
      expect(result.current.permissions.size).toBeGreaterThan(0)
    })

    it(`should fall back to role-based computation when serverPermissions is undefined`, () => {
      const { result } = renderHook(() =>
        usePermissions(ERoleType.member, undefined, undefined)
      )
      // should behave exactly as regular member
      expect(result.current.has(`org:read`)).toBe(true)
      expect(result.current.has(`sandbox:exec`)).toBe(true)
      expect(result.current.has(`org:delete`)).toBe(false)
    })

    it(`should not treat string 'super' as an array`, () => {
      // 'super' is a string, not an array — must go through the super sentinel path
      const { result } = renderHook(() =>
        usePermissions(ERoleType.owner, undefined, ERoleType.super)
      )
      // Array.isArray('super') is false, so it should hit the super path, not the array path
      expect(result.current.has(`org:delete`)).toBe(true)
    })

    it(`should ignore empty serverPermissions array and use overrides path`, () => {
      // empty array is falsy for .length check, so falls through to overrides path
      const { result } = renderHook(() =>
        usePermissions(ERoleType.member, undefined, [] as any)
      )
      // no overrides either, so member template perms apply
      expect(result.current.has(`org:read`)).toBe(true)
      expect(result.current.has(`sandbox:exec`)).toBe(true)
    })
  })

  describe(`overrides`, () => {
    it(`should grant additional permissions via overrides`, () => {
      const overrides = [
        {
          id: 'ov1',
          userId: 'u1',
          grantedBy: 'admin1',
          permission: 'secret:manage' as const,
          effect: 'grant' as const,
        },
      ]
      const { result } = renderHook(() => usePermissions(ERoleType.member, overrides))
      expect(result.current.has('secret:manage')).toBe(true)
      expect(result.current.canAccessSecretValues).toBe(true)
    })

    it(`should deny permissions via deny overrides`, () => {
      const overrides = [
        {
          id: 'ov1',
          userId: 'u1',
          grantedBy: 'admin1',
          permission: 'sandbox:exec' as const,
          effect: 'deny' as const,
        },
      ]
      const { result } = renderHook(() => usePermissions(ERoleType.member, overrides))
      expect(result.current.has('sandbox:exec')).toBe(false)
      expect(result.current.canExec(EPermResource.sandbox)).toBe(false)
    })

    it(`should ignore expired overrides`, () => {
      const overrides = [
        {
          id: 'ov1',
          userId: 'u1',
          grantedBy: 'admin1',
          permission: 'secret:manage' as const,
          effect: 'grant' as const,
          expiresAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ]
      const { result } = renderHook(() => usePermissions(ERoleType.member, overrides))
      expect(result.current.has('secret:manage')).toBe(false)
    })
  })
})
