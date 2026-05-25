import type { PermissionOverride } from '@TDM/models/permissionOverride'

import { describe, it, expect } from 'vitest'
import { ERoleType, EPermAction, EPermResource } from '@TDM/types'
import { RoleHierarchy, RoleTemplates } from '@TDM/constants/values'
import {
  hasMinRole,
  canPerform,
  getRoleLevel,
  isSuperAdmin,
  canManageRole,
  getHighestRole,
  isValidRoleType,
  getAllowedActions,
  buildRolePermissions,
  resolvePermissions,
} from '@TDM/utils/permissions'

describe(`permissions utilities`, () => {
  describe(`RoleHierarchy`, () => {
    it(`should have 4 roles in order from lowest to highest`, () => {
      expect(RoleHierarchy).toHaveLength(4)
      expect(RoleHierarchy).toEqual([
        ERoleType.member,
        ERoleType.admin,
        ERoleType.owner,
        ERoleType.super,
      ])
    })

    it(`should have member as lowest and super as highest`, () => {
      expect(RoleHierarchy[0]).toBe(ERoleType.member)
      expect(RoleHierarchy[3]).toBe(ERoleType.super)
    })
  })

  describe(`RoleTemplates`, () => {
    it(`should have entries for member, admin, and owner`, () => {
      expect(RoleTemplates[ERoleType.member]).toBeDefined()
      expect(RoleTemplates[ERoleType.admin]).toBeDefined()
      expect(RoleTemplates[ERoleType.owner]).toBeDefined()
    })

    it(`should not have an entry for super`, () => {
      expect((RoleTemplates as Record<string, unknown>)[ERoleType.super]).toBeUndefined()
    })

    it(`should include sandbox:connect in member permissions`, () => {
      expect(RoleTemplates[ERoleType.member]).toContain('sandbox:connect')
    })

    it(`should include org:transfer in owner permissions`, () => {
      expect(RoleTemplates[ERoleType.owner]).toContain('org:transfer')
    })

    it(`should include adminPanel:read in member permissions`, () => {
      expect(RoleTemplates[ERoleType.member]).toContain('adminPanel:read')
    })
  })

  describe(`getRoleLevel`, () => {
    it(`should return 0 for member`, () => {
      expect(getRoleLevel(ERoleType.member)).toBe(0)
    })

    it(`should return 1 for admin`, () => {
      expect(getRoleLevel(ERoleType.admin)).toBe(1)
    })

    it(`should return 2 for owner`, () => {
      expect(getRoleLevel(ERoleType.owner)).toBe(2)
    })

    it(`should return 3 for super`, () => {
      expect(getRoleLevel(ERoleType.super)).toBe(3)
    })

    it(`should return -1 for invalid role`, () => {
      expect(getRoleLevel(`invalid` as ERoleType)).toBe(-1)
    })

    it(`should return -1 for null (non-member)`, () => {
      expect(getRoleLevel(null)).toBe(-1)
    })
  })

  describe(`hasMinRole`, () => {
    it(`should return true when user role equals required role`, () => {
      expect(hasMinRole(ERoleType.admin, ERoleType.admin)).toBe(true)
      expect(hasMinRole(ERoleType.member, ERoleType.member)).toBe(true)
    })

    it(`should return true when user role is higher than required`, () => {
      expect(hasMinRole(ERoleType.admin, ERoleType.member)).toBe(true)
      expect(hasMinRole(ERoleType.owner, ERoleType.admin)).toBe(true)
      expect(hasMinRole(ERoleType.super, ERoleType.member)).toBe(true)
    })

    it(`should return false when user role is lower than required`, () => {
      expect(hasMinRole(ERoleType.member, ERoleType.admin)).toBe(false)
      expect(hasMinRole(ERoleType.admin, ERoleType.owner)).toBe(false)
    })

    it(`should handle edge cases`, () => {
      expect(hasMinRole(ERoleType.super, ERoleType.super)).toBe(true)
      expect(hasMinRole(ERoleType.member, ERoleType.super)).toBe(false)
    })

    it(`should return false for null (non-member)`, () => {
      expect(hasMinRole(null, ERoleType.member)).toBe(false)
      expect(hasMinRole(null, ERoleType.admin)).toBe(false)
      expect(hasMinRole(null, ERoleType.owner)).toBe(false)
      expect(hasMinRole(null, ERoleType.super)).toBe(false)
    })
  })

  describe(`buildRolePermissions`, () => {
    it(`should return only member template permissions for member role`, () => {
      const perms = buildRolePermissions(ERoleType.member)
      expect(perms).toEqual(RoleTemplates[ERoleType.member])
    })

    it(`should return member + admin template permissions for admin role`, () => {
      const perms = buildRolePermissions(ERoleType.admin)
      const expected = [
        ...RoleTemplates[ERoleType.member],
        ...RoleTemplates[ERoleType.admin],
      ]
      expect(perms).toEqual(expected)
    })

    it(`should return member + admin + owner template permissions for owner role`, () => {
      const perms = buildRolePermissions(ERoleType.owner)
      const expected = [
        ...RoleTemplates[ERoleType.member],
        ...RoleTemplates[ERoleType.admin],
        ...RoleTemplates[ERoleType.owner],
      ]
      expect(perms).toEqual(expected)
    })

    it(`should return empty array for super (bypasses checks)`, () => {
      expect(buildRolePermissions(ERoleType.super)).toEqual([])
    })

    it(`should return empty array for invalid role`, () => {
      expect(buildRolePermissions(`invalid` as ERoleType)).toEqual([])
    })

    it(`should include sandbox:exec for member`, () => {
      const perms = buildRolePermissions(ERoleType.member)
      expect(perms).toContain('sandbox:exec')
    })

    it(`should include sandbox:manage for admin`, () => {
      const perms = buildRolePermissions(ERoleType.admin)
      expect(perms).toContain('sandbox:manage')
    })

    it(`should include org:delete for owner`, () => {
      const perms = buildRolePermissions(ERoleType.owner)
      expect(perms).toContain('org:delete')
    })

    it(`should include org:transfer for owner`, () => {
      const perms = buildRolePermissions(ERoleType.owner)
      expect(perms).toContain('org:transfer')
    })

    it(`admin permissions should be a superset of member permissions`, () => {
      const memberPerms = new Set(buildRolePermissions(ERoleType.member))
      const adminPerms = new Set(buildRolePermissions(ERoleType.admin))
      for (const perm of memberPerms) {
        expect(adminPerms.has(perm)).toBe(true)
      }
    })

    it(`owner permissions should be a superset of admin permissions`, () => {
      const adminPerms = new Set(buildRolePermissions(ERoleType.admin))
      const ownerPerms = new Set(buildRolePermissions(ERoleType.owner))
      for (const perm of adminPerms) {
        expect(ownerPerms.has(perm)).toBe(true)
      }
    })
  })

  describe(`resolvePermissions`, () => {
    it(`should return default permissions when no overrides provided`, () => {
      const result = resolvePermissions(ERoleType.member, [])
      const expected = new Set(buildRolePermissions(ERoleType.member))
      expect(result).toEqual(expected)
    })

    it(`should return empty set for super admin`, () => {
      const result = resolvePermissions(ERoleType.super, [])
      expect(result.size).toBe(0)
    })

    it(`should add a grant override to the default set`, () => {
      const overrides: PermissionOverride[] = [
        {
          id: 'po_test1',
          userId: 'user1',
          permission: 'secret:create',
          effect: 'grant',
          grantedBy: 'admin1',
        },
      ]
      const result = resolvePermissions(ERoleType.member, overrides)
      expect(result.has('secret:create')).toBe(true)
    })

    it(`should remove a deny override from the default set`, () => {
      const overrides: PermissionOverride[] = [
        {
          id: 'po_test2',
          userId: 'user1',
          permission: 'sandbox:exec',
          effect: 'deny',
          grantedBy: 'admin1',
        },
      ]
      const result = resolvePermissions(ERoleType.member, overrides)
      expect(result.has('sandbox:exec')).toBe(false)
    })

    it(`should let deny win over grant for the same permission`, () => {
      const overrides: PermissionOverride[] = [
        {
          id: 'po_grant',
          userId: 'user1',
          permission: 'secret:create',
          effect: 'grant',
          grantedBy: 'admin1',
        },
        {
          id: 'po_deny',
          userId: 'user1',
          permission: 'secret:create',
          effect: 'deny',
          grantedBy: 'admin2',
        },
      ]
      const result = resolvePermissions(ERoleType.member, overrides)
      expect(result.has('secret:create')).toBe(false)
    })

    it(`should ignore expired overrides`, () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString()
      const overrides: PermissionOverride[] = [
        {
          id: 'po_expired',
          userId: 'user1',
          permission: 'sandbox:exec',
          effect: 'deny',
          grantedBy: 'admin1',
          expiresAt: pastDate,
        },
      ]
      const result = resolvePermissions(ERoleType.member, overrides)
      expect(result.has('sandbox:exec')).toBe(true)
    })

    it(`should apply non-expired overrides`, () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      const overrides: PermissionOverride[] = [
        {
          id: 'po_active',
          userId: 'user1',
          permission: 'sandbox:exec',
          effect: 'deny',
          grantedBy: 'admin1',
          expiresAt: futureDate,
        },
      ]
      const result = resolvePermissions(ERoleType.member, overrides)
      expect(result.has('sandbox:exec')).toBe(false)
    })
  })

  describe(`canPerform`, () => {
    describe(`org permissions`, () => {
      it(`should allow member to read orgs`, () => {
        const result = canPerform(ERoleType.member, EPermAction.read, EPermResource.org)
        expect(result.allowed).toBe(true)
      })

      it(`should deny member from updating orgs`, () => {
        const result = canPerform(ERoleType.member, EPermAction.update, EPermResource.org)
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('org:update')
      })

      it(`should allow admin to update orgs`, () => {
        const result = canPerform(ERoleType.admin, EPermAction.update, EPermResource.org)
        expect(result.allowed).toBe(true)
      })

      it(`should deny admin from deleting orgs`, () => {
        const result = canPerform(ERoleType.admin, EPermAction.delete, EPermResource.org)
        expect(result.allowed).toBe(false)
      })

      it(`should allow owner to delete orgs`, () => {
        const result = canPerform(ERoleType.owner, EPermAction.delete, EPermResource.org)
        expect(result.allowed).toBe(true)
      })
    })

    describe(`secret permissions`, () => {
      it(`should allow member to read secrets (metadata only)`, () => {
        const result = canPerform(
          ERoleType.member,
          EPermAction.read,
          EPermResource.secret
        )
        expect(result.allowed).toBe(true)
      })

      it(`should deny member from creating secrets`, () => {
        const result = canPerform(
          ERoleType.member,
          EPermAction.create,
          EPermResource.secret
        )
        expect(result.allowed).toBe(false)
      })

      it(`should allow admin to manage secrets`, () => {
        const result = canPerform(
          ERoleType.admin,
          EPermAction.create,
          EPermResource.secret
        )
        expect(result.allowed).toBe(true)
      })
    })

    describe(`apiKey permissions`, () => {
      it(`should allow member to create API keys`, () => {
        expect(
          canPerform(ERoleType.member, EPermAction.create, EPermResource.apiKey).allowed
        ).toBe(true)
      })

      it(`should allow member to read API keys`, () => {
        expect(
          canPerform(ERoleType.member, EPermAction.read, EPermResource.apiKey).allowed
        ).toBe(true)
      })

      it(`should deny member from deleting API keys`, () => {
        expect(
          canPerform(ERoleType.member, EPermAction.delete, EPermResource.apiKey).allowed
        ).toBe(false)
      })

      it(`should allow admin for API key delete and manage`, () => {
        expect(
          canPerform(ERoleType.admin, EPermAction.delete, EPermResource.apiKey).allowed
        ).toBe(true)
        expect(
          canPerform(ERoleType.admin, EPermAction.manage, EPermResource.apiKey).allowed
        ).toBe(true)
      })
    })

    describe(`null role (non-member)`, () => {
      it(`should deny all actions for null role`, () => {
        for (const resource of Object.values(EPermResource)) {
          for (const action of Object.values(EPermAction)) {
            const result = canPerform(null, action, resource)
            expect(result.allowed).toBe(false)
            expect(result.reason).toBe(`Not a member of this organization or project`)
          }
        }
      })
    })

    describe(`exec action`, () => {
      it(`should allow member to exec sandbox`, () => {
        const result = canPerform(
          ERoleType.member,
          EPermAction.exec,
          EPermResource.sandbox
        )
        expect(result.allowed).toBe(true)
      })

      it(`should allow member to exec agent`, () => {
        const result = canPerform(ERoleType.member, EPermAction.exec, EPermResource.agent)
        expect(result.allowed).toBe(true)
      })

      it(`should allow member to exec function`, () => {
        const result = canPerform(
          ERoleType.member,
          EPermAction.exec,
          EPermResource.function
        )
        expect(result.allowed).toBe(true)
      })

      it(`should deny null role from exec any resource`, () => {
        for (const resource of Object.values(EPermResource)) {
          const result = canPerform(null, EPermAction.exec, resource)
          expect(result.allowed).toBe(false)
          expect(result.reason).toBe(`Not a member of this organization or project`)
        }
      })
    })

    describe(`connect action`, () => {
      it(`should allow member to connect to sandbox`, () => {
        const result = canPerform(
          ERoleType.member,
          EPermAction.connect,
          EPermResource.sandbox
        )
        expect(result.allowed).toBe(true)
      })
    })

    describe(`transfer action`, () => {
      it(`should allow owner to transfer org`, () => {
        const result = canPerform(
          ERoleType.owner,
          EPermAction.transfer,
          EPermResource.org
        )
        expect(result.allowed).toBe(true)
      })

      it(`should deny admin from transferring org`, () => {
        const result = canPerform(
          ERoleType.admin,
          EPermAction.transfer,
          EPermResource.org
        )
        expect(result.allowed).toBe(false)
      })
    })

    describe(`super admin bypass`, () => {
      it(`should allow super admin all actions on all resources`, () => {
        for (const resource of Object.values(EPermResource)) {
          for (const action of Object.values(EPermAction)) {
            const result = canPerform(ERoleType.super, action, resource)
            expect(result.allowed).toBe(true)
          }
        }
      })
    })
  })

  describe(`isSuperAdmin`, () => {
    it(`should return false for all roles except super`, () => {
      expect(isSuperAdmin(ERoleType.member)).toBe(false)
      expect(isSuperAdmin(ERoleType.admin)).toBe(false)
      expect(isSuperAdmin(ERoleType.owner)).toBe(false)
    })

    it(`should return true only for super`, () => {
      expect(isSuperAdmin(ERoleType.super)).toBe(true)
    })

    it(`should return false for null (non-member)`, () => {
      expect(isSuperAdmin(null)).toBe(false)
    })
  })

  describe(`getHighestRole`, () => {
    it(`should return null for empty array`, () => {
      expect(getHighestRole([])).toBeNull()
    })

    it(`should return single role when array has one item`, () => {
      expect(getHighestRole([ERoleType.admin])).toBe(ERoleType.admin)
    })

    it(`should return highest role from array`, () => {
      expect(getHighestRole([ERoleType.admin, ERoleType.member])).toBe(ERoleType.admin)
    })

    it(`should return super when it exists in array`, () => {
      expect(getHighestRole([ERoleType.admin, ERoleType.super, ERoleType.member])).toBe(
        ERoleType.super
      )
    })

    it(`should handle duplicate roles`, () => {
      expect(getHighestRole([ERoleType.member, ERoleType.member, ERoleType.member])).toBe(
        ERoleType.member
      )
    })

    it(`should return null when all roles are null`, () => {
      expect(getHighestRole([null, null, null])).toBeNull()
    })

    it(`should filter out null values and return highest valid role`, () => {
      expect(getHighestRole([null, ERoleType.admin, null, ERoleType.member])).toBe(
        ERoleType.admin
      )
    })
  })

  describe(`canManageRole`, () => {
    it(`should allow super admin to manage any role`, () => {
      expect(canManageRole(ERoleType.super, ERoleType.owner)).toBe(true)
      expect(canManageRole(ERoleType.super, ERoleType.admin)).toBe(true)
      expect(canManageRole(ERoleType.super, ERoleType.member)).toBe(true)
    })

    it(`should allow owner to manage admin and member`, () => {
      expect(canManageRole(ERoleType.owner, ERoleType.admin)).toBe(true)
      expect(canManageRole(ERoleType.owner, ERoleType.member)).toBe(true)
    })

    it(`should not allow owner to manage owner or super`, () => {
      expect(canManageRole(ERoleType.owner, ERoleType.owner)).toBe(false)
      expect(canManageRole(ERoleType.owner, ERoleType.super)).toBe(false)
    })

    it(`should allow admin to manage member`, () => {
      expect(canManageRole(ERoleType.admin, ERoleType.member)).toBe(true)
    })

    it(`should not allow admin to manage admin, owner, or super`, () => {
      expect(canManageRole(ERoleType.admin, ERoleType.admin)).toBe(false)
      expect(canManageRole(ERoleType.admin, ERoleType.owner)).toBe(false)
      expect(canManageRole(ERoleType.admin, ERoleType.super)).toBe(false)
    })

    it(`should not allow member to manage member or higher`, () => {
      expect(canManageRole(ERoleType.member, ERoleType.member)).toBe(false)
      expect(canManageRole(ERoleType.member, ERoleType.admin)).toBe(false)
    })

    it(`should not allow null (non-member) to manage anyone`, () => {
      expect(canManageRole(null, ERoleType.member)).toBe(false)
      expect(canManageRole(null, ERoleType.admin)).toBe(false)
      expect(canManageRole(null, ERoleType.owner)).toBe(false)
      expect(canManageRole(null, ERoleType.super)).toBe(false)
    })
  })

  describe(`getAllowedActions`, () => {
    it(`should return all actions for super admin on any resource`, () => {
      const actions = getAllowedActions(ERoleType.super, EPermResource.org)
      expect(actions).toContain(EPermAction.create)
      expect(actions).toContain(EPermAction.read)
      expect(actions).toContain(EPermAction.update)
      expect(actions).toContain(EPermAction.delete)
      expect(actions).toContain(EPermAction.manage)
      expect(actions).toContain(EPermAction.exec)
      expect(actions).toContain(EPermAction.connect)
      expect(actions).toContain(EPermAction.transfer)
    })

    it(`should return read-related actions for member on org`, () => {
      const actions = getAllowedActions(ERoleType.member, EPermResource.org)
      expect(actions).toContain(EPermAction.read)
      expect(actions).not.toContain(EPermAction.update)
      expect(actions).not.toContain(EPermAction.delete)
    })

    it(`should return create, read, update actions for member on project`, () => {
      const actions = getAllowedActions(ERoleType.member, EPermResource.project)
      expect(actions).toContain(EPermAction.create)
      expect(actions).toContain(EPermAction.read)
      expect(actions).toContain(EPermAction.update)
      expect(actions).not.toContain(EPermAction.delete)
      expect(actions).not.toContain(EPermAction.manage)
    })

    it(`should return empty array for invalid resource`, () => {
      const actions = getAllowedActions(ERoleType.admin, `invalid` as EPermResource)
      expect(actions).toEqual([])
    })

    it(`should return create and read for member on API keys`, () => {
      const actions = getAllowedActions(ERoleType.member, EPermResource.apiKey)
      expect(actions).toContain(EPermAction.create)
      expect(actions).toContain(EPermAction.read)
      expect(actions).not.toContain(EPermAction.delete)
    })

    it(`should include exec in allowed actions for member on sandbox`, () => {
      const actions = getAllowedActions(ERoleType.member, EPermResource.sandbox)
      expect(actions).toContain(EPermAction.exec)
      expect(actions).toContain(EPermAction.connect)
    })

    it(`should return empty array for null (non-member)`, () => {
      expect(getAllowedActions(null, EPermResource.org)).toEqual([])
      expect(getAllowedActions(null, EPermResource.project)).toEqual([])
      expect(getAllowedActions(null, EPermResource.apiKey)).toEqual([])
    })
  })

  describe(`isValidRoleType`, () => {
    it(`should return true for valid role types`, () => {
      expect(isValidRoleType(`member`)).toBe(true)
      expect(isValidRoleType(`admin`)).toBe(true)
      expect(isValidRoleType(`owner`)).toBe(true)
      expect(isValidRoleType(`super`)).toBe(true)
    })

    it(`should return false for viewer (removed role)`, () => {
      expect(isValidRoleType(`viewer`)).toBe(false)
    })

    it(`should return false for invalid role types`, () => {
      expect(isValidRoleType(`invalid`)).toBe(false)
      expect(isValidRoleType(``)).toBe(false)
      expect(isValidRoleType(`ADMIN`)).toBe(false)
      expect(isValidRoleType(`Admin`)).toBe(false)
      expect(isValidRoleType(`superadmin`)).toBe(false)
    })
  })
})
