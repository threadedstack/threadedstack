import { describe, it, expect } from 'vitest'
import { ERoleType, EPermAction, EPermResource } from '@TDM/types'
import { RoleHierarchy, PermissionMatrix } from '@TDM/constants/values'
import {
  hasMinRole,
  canPerform,
  getRoleLevel,
  isSuperAdmin,
  canManageRole,
  getHighestRole,
  isValidRoleType,
  getAllowedActions,
  canAccessSecretValue,
} from '@TDM/utils/permissions'

describe(`permissions utilities`, () => {
  describe(`RoleHierarchy`, () => {
    it(`should have 5 roles in order from lowest to highest`, () => {
      expect(RoleHierarchy).toHaveLength(5)
      expect(RoleHierarchy).toEqual([
        ERoleType.viewer,
        ERoleType.member,
        ERoleType.admin,
        ERoleType.owner,
        ERoleType.super,
      ])
    })

    it(`should have viewer as lowest and super as highest`, () => {
      expect(RoleHierarchy[0]).toBe(ERoleType.viewer)
      expect(RoleHierarchy[4]).toBe(ERoleType.super)
    })
  })

  describe(`PermissionMatrix`, () => {
    it(`should have entries for all resources`, () => {
      const resources = Object.values(EPermResource)
      for (const resource of resources) {
        expect(PermissionMatrix[resource]).toBeDefined()
      }
    })

    it(`should have entries for all actions on each resource`, () => {
      const actions = Object.values(EPermAction)
      for (const resource of Object.values(EPermResource)) {
        for (const action of actions) {
          expect(PermissionMatrix[resource][action]).toBeDefined()
        }
      }
    })

    it(`should require admin for secret creation`, () => {
      expect(PermissionMatrix[EPermResource.secret][EPermAction.create]).toBe(
        ERoleType.admin
      )
    })

    it(`should require admin for API key operations`, () => {
      expect(PermissionMatrix[EPermResource.apiKey][EPermAction.create]).toBe(
        ERoleType.admin
      )
      expect(PermissionMatrix[EPermResource.apiKey][EPermAction.read]).toBe(
        ERoleType.admin
      )
      expect(PermissionMatrix[EPermResource.apiKey][EPermAction.delete]).toBe(
        ERoleType.admin
      )
    })

    it(`should allow viewer to read orgs and projects`, () => {
      expect(PermissionMatrix[EPermResource.org][EPermAction.read]).toBe(ERoleType.viewer)
      expect(PermissionMatrix[EPermResource.project][EPermAction.read]).toBe(
        ERoleType.viewer
      )
    })

    it(`should require owner to delete orgs or users`, () => {
      expect(PermissionMatrix[EPermResource.org][EPermAction.delete]).toBe(
        ERoleType.owner
      )
      expect(PermissionMatrix[EPermResource.user][EPermAction.delete]).toBe(
        ERoleType.owner
      )
    })
  })

  describe(`getRoleLevel`, () => {
    it(`should return 0 for viewer`, () => {
      expect(getRoleLevel(ERoleType.viewer)).toBe(0)
    })

    it(`should return 1 for member`, () => {
      expect(getRoleLevel(ERoleType.member)).toBe(1)
    })

    it(`should return 2 for admin`, () => {
      expect(getRoleLevel(ERoleType.admin)).toBe(2)
    })

    it(`should return 3 for owner`, () => {
      expect(getRoleLevel(ERoleType.owner)).toBe(3)
    })

    it(`should return 4 for super`, () => {
      expect(getRoleLevel(ERoleType.super)).toBe(4)
    })

    it(`should return -1 for invalid role`, () => {
      expect(getRoleLevel(`invalid` as ERoleType)).toBe(-1)
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
      expect(hasMinRole(ERoleType.super, ERoleType.viewer)).toBe(true)
    })

    it(`should return false when user role is lower than required`, () => {
      expect(hasMinRole(ERoleType.viewer, ERoleType.member)).toBe(false)
      expect(hasMinRole(ERoleType.member, ERoleType.admin)).toBe(false)
      expect(hasMinRole(ERoleType.admin, ERoleType.owner)).toBe(false)
    })

    it(`should handle edge cases`, () => {
      expect(hasMinRole(ERoleType.super, ERoleType.super)).toBe(true)
      expect(hasMinRole(ERoleType.viewer, ERoleType.super)).toBe(false)
    })
  })

  describe(`canPerform`, () => {
    describe(`org permissions`, () => {
      it(`should allow member to create orgs`, () => {
        const result = canPerform(ERoleType.member, EPermAction.create, EPermResource.org)
        expect(result.allowed).toBe(true)
      })

      it(`should allow viewer to read orgs`, () => {
        const result = canPerform(ERoleType.viewer, EPermAction.read, EPermResource.org)
        expect(result.allowed).toBe(true)
      })

      it(`should deny viewer from creating orgs`, () => {
        const result = canPerform(ERoleType.viewer, EPermAction.create, EPermResource.org)
        expect(result.allowed).toBe(false)
        expect(result.requiredRole).toBe(ERoleType.member)
        expect(result.reason).toContain(`member`)
      })

      it(`should deny member from updating orgs`, () => {
        const result = canPerform(ERoleType.member, EPermAction.update, EPermResource.org)
        expect(result.allowed).toBe(false)
        expect(result.requiredRole).toBe(ERoleType.admin)
      })

      it(`should allow admin to update orgs`, () => {
        const result = canPerform(ERoleType.admin, EPermAction.update, EPermResource.org)
        expect(result.allowed).toBe(true)
      })

      it(`should deny admin from deleting orgs`, () => {
        const result = canPerform(ERoleType.admin, EPermAction.delete, EPermResource.org)
        expect(result.allowed).toBe(false)
        expect(result.requiredRole).toBe(ERoleType.owner)
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
        expect(result.requiredRole).toBe(ERoleType.admin)
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
      it(`should deny member from all API key operations`, () => {
        expect(
          canPerform(ERoleType.member, EPermAction.create, EPermResource.apiKey).allowed
        ).toBe(false)
        expect(
          canPerform(ERoleType.member, EPermAction.read, EPermResource.apiKey).allowed
        ).toBe(false)
        expect(
          canPerform(ERoleType.member, EPermAction.delete, EPermResource.apiKey).allowed
        ).toBe(false)
      })

      it(`should allow admin for all API key operations`, () => {
        expect(
          canPerform(ERoleType.admin, EPermAction.create, EPermResource.apiKey).allowed
        ).toBe(true)
        expect(
          canPerform(ERoleType.admin, EPermAction.read, EPermResource.apiKey).allowed
        ).toBe(true)
        expect(
          canPerform(ERoleType.admin, EPermAction.delete, EPermResource.apiKey).allowed
        ).toBe(true)
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

  describe(`canAccessSecretValue`, () => {
    it(`should return false for viewer`, () => {
      expect(canAccessSecretValue(ERoleType.viewer)).toBe(false)
    })

    it(`should return false for member`, () => {
      expect(canAccessSecretValue(ERoleType.member)).toBe(false)
    })

    it(`should return true for admin`, () => {
      expect(canAccessSecretValue(ERoleType.admin)).toBe(true)
    })

    it(`should return true for owner`, () => {
      expect(canAccessSecretValue(ERoleType.owner)).toBe(true)
    })

    it(`should return true for super`, () => {
      expect(canAccessSecretValue(ERoleType.super)).toBe(true)
    })
  })

  describe(`isSuperAdmin`, () => {
    it(`should return false for all roles except super`, () => {
      expect(isSuperAdmin(ERoleType.viewer)).toBe(false)
      expect(isSuperAdmin(ERoleType.member)).toBe(false)
      expect(isSuperAdmin(ERoleType.admin)).toBe(false)
      expect(isSuperAdmin(ERoleType.owner)).toBe(false)
    })

    it(`should return true only for super`, () => {
      expect(isSuperAdmin(ERoleType.super)).toBe(true)
    })
  })

  describe(`getHighestRole`, () => {
    it(`should return viewer for empty array`, () => {
      expect(getHighestRole([])).toBe(ERoleType.viewer)
    })

    it(`should return single role when array has one item`, () => {
      expect(getHighestRole([ERoleType.admin])).toBe(ERoleType.admin)
    })

    it(`should return highest role from array`, () => {
      expect(getHighestRole([ERoleType.viewer, ERoleType.admin, ERoleType.member])).toBe(
        ERoleType.admin
      )
    })

    it(`should return super when it exists in array`, () => {
      expect(
        getHighestRole([
          ERoleType.viewer,
          ERoleType.admin,
          ERoleType.super,
          ERoleType.member,
        ])
      ).toBe(ERoleType.super)
    })

    it(`should handle duplicate roles`, () => {
      expect(getHighestRole([ERoleType.member, ERoleType.member, ERoleType.member])).toBe(
        ERoleType.member
      )
    })
  })

  describe(`canManageRole`, () => {
    it(`should allow super admin to manage any role`, () => {
      expect(canManageRole(ERoleType.super, ERoleType.owner)).toBe(true)
      expect(canManageRole(ERoleType.super, ERoleType.admin)).toBe(true)
      expect(canManageRole(ERoleType.super, ERoleType.member)).toBe(true)
      expect(canManageRole(ERoleType.super, ERoleType.viewer)).toBe(true)
    })

    it(`should allow owner to manage admin, member, and viewer`, () => {
      expect(canManageRole(ERoleType.owner, ERoleType.admin)).toBe(true)
      expect(canManageRole(ERoleType.owner, ERoleType.member)).toBe(true)
      expect(canManageRole(ERoleType.owner, ERoleType.viewer)).toBe(true)
    })

    it(`should not allow owner to manage owner or super`, () => {
      expect(canManageRole(ERoleType.owner, ERoleType.owner)).toBe(false)
      expect(canManageRole(ERoleType.owner, ERoleType.super)).toBe(false)
    })

    it(`should allow admin to manage member and viewer`, () => {
      expect(canManageRole(ERoleType.admin, ERoleType.member)).toBe(true)
      expect(canManageRole(ERoleType.admin, ERoleType.viewer)).toBe(true)
    })

    it(`should not allow admin to manage admin, owner, or super`, () => {
      expect(canManageRole(ERoleType.admin, ERoleType.admin)).toBe(false)
      expect(canManageRole(ERoleType.admin, ERoleType.owner)).toBe(false)
      expect(canManageRole(ERoleType.admin, ERoleType.super)).toBe(false)
    })

    it(`should allow member to manage viewer only`, () => {
      expect(canManageRole(ERoleType.member, ERoleType.viewer)).toBe(true)
    })

    it(`should not allow member to manage member or higher`, () => {
      expect(canManageRole(ERoleType.member, ERoleType.member)).toBe(false)
      expect(canManageRole(ERoleType.member, ERoleType.admin)).toBe(false)
    })

    it(`should not allow viewer to manage anyone`, () => {
      expect(canManageRole(ERoleType.viewer, ERoleType.viewer)).toBe(false)
      expect(canManageRole(ERoleType.viewer, ERoleType.member)).toBe(false)
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
    })

    it(`should return limited actions for viewer on org`, () => {
      const actions = getAllowedActions(ERoleType.viewer, EPermResource.org)
      expect(actions).toContain(EPermAction.read)
      expect(actions).not.toContain(EPermAction.create)
      expect(actions).not.toContain(EPermAction.update)
      expect(actions).not.toContain(EPermAction.delete)
    })

    it(`should return more actions for member on project`, () => {
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

    it(`should return no actions for viewer on API keys`, () => {
      const actions = getAllowedActions(ERoleType.viewer, EPermResource.apiKey)
      expect(actions).toEqual([])
    })

    it(`should return all actions for admin on API keys`, () => {
      const actions = getAllowedActions(ERoleType.admin, EPermResource.apiKey)
      expect(actions).toContain(EPermAction.create)
      expect(actions).toContain(EPermAction.read)
      expect(actions).toContain(EPermAction.update)
      expect(actions).toContain(EPermAction.delete)
      expect(actions).toContain(EPermAction.manage)
    })
  })

  describe(`isValidRoleType`, () => {
    it(`should return true for valid role types`, () => {
      expect(isValidRoleType(`viewer`)).toBe(true)
      expect(isValidRoleType(`member`)).toBe(true)
      expect(isValidRoleType(`admin`)).toBe(true)
      expect(isValidRoleType(`owner`)).toBe(true)
      expect(isValidRoleType(`super`)).toBe(true)
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
