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
      expect(result.current.isViewer).toBe(false)
    })

    it(`should deny all action checks`, () => {
      const { result } = renderHook(() => usePermissions(null))
      expect(result.current.canRead(EPermResource.org)).toBe(false)
      expect(result.current.canCreate(EPermResource.org)).toBe(false)
      expect(result.current.canUpdate(EPermResource.org)).toBe(false)
      expect(result.current.canDelete(EPermResource.org)).toBe(false)
      expect(result.current.canExec(EPermResource.sandbox)).toBe(false)
      expect(result.current.canManage(EPermResource.org)).toBe(false)
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
      expect(result.current.canAssignRole(ERoleType.viewer)).toBe(false)
      expect(result.current.canAssignRole(ERoleType.member)).toBe(false)
    })
  })

  describe(`viewer role`, () => {
    it(`should have isViewer true and other is* booleans false`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.viewer))
      expect(result.current.isViewer).toBe(true)
      expect(result.current.isMember).toBe(false)
      expect(result.current.isAdmin).toBe(false)
      expect(result.current.isOwner).toBe(false)
      expect(result.current.isSuper).toBe(false)
    })

    it(`should allow reading org resources`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.viewer))
      expect(result.current.canRead(EPermResource.org)).toBe(true)
    })

    it(`should deny creating org resources`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.viewer))
      expect(result.current.canCreate(EPermResource.org)).toBe(false)
    })

    it(`should deny secret value access`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.viewer))
      expect(result.current.canAccessSecretValues).toBe(false)
    })

    it(`should deny managing members`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.viewer))
      expect(result.current.canManageMembers).toBe(false)
    })
  })

  describe(`member role`, () => {
    it(`should have isMember true and higher roles false`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.isViewer).toBe(true)
      expect(result.current.isMember).toBe(true)
      expect(result.current.isAdmin).toBe(false)
      expect(result.current.isOwner).toBe(false)
      expect(result.current.isSuper).toBe(false)
    })

    it(`should allow exec on sandbox (sandbox.exec requires member)`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.canExec(EPermResource.sandbox)).toBe(true)
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
  })

  describe(`admin role`, () => {
    it(`should have isAdmin true`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.admin))
      expect(result.current.isViewer).toBe(true)
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
      expect(result.current.isViewer).toBe(true)
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
      expect(result.current.isViewer).toBe(true)
    })

    it(`should allow all action checks`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.super))
      expect(result.current.canRead(EPermResource.org)).toBe(true)
      expect(result.current.canCreate(EPermResource.org)).toBe(true)
      expect(result.current.canUpdate(EPermResource.org)).toBe(true)
      expect(result.current.canDelete(EPermResource.org)).toBe(true)
      expect(result.current.canExec(EPermResource.sandbox)).toBe(true)
      expect(result.current.canManage(EPermResource.org)).toBe(true)
    })

    it(`should allow all convenience booleans`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.super))
      expect(result.current.canDeleteOrg).toBe(true)
      expect(result.current.canAccessSecretValues).toBe(true)
      expect(result.current.canInviteUsers).toBe(true)
      expect(result.current.canManageMembers).toBe(true)
      expect(result.current.canManageApiKeys).toBe(true)
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
      expect(result.current.canAssignRole(ERoleType.viewer)).toBe(true)
      expect(result.current.canAssignRole(ERoleType.member)).toBe(true)
      expect(result.current.canAssignRole(ERoleType.admin)).toBe(true)
      expect(result.current.canAssignRole(ERoleType.owner)).toBe(true)
    })

    it(`should deny member assigning viewer`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.canAssignRole(ERoleType.viewer)).toBe(true)
    })

    it(`should deny member assigning member (same level)`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.member))
      expect(result.current.canAssignRole(ERoleType.member)).toBe(false)
    })

    it(`should deny viewer assigning any role`, () => {
      const { result } = renderHook(() => usePermissions(ERoleType.viewer))
      expect(result.current.canAssignRole(ERoleType.viewer)).toBe(false)
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
      const viewer = renderHook(() => usePermissions(ERoleType.viewer))

      expect(admin.result.current.canManageMembers).toBe(true)
      expect(member.result.current.canManageMembers).toBe(false)
      expect(viewer.result.current.canManageMembers).toBe(false)
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
})
