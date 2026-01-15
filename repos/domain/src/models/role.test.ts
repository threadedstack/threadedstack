import { describe, it, expect } from 'vitest'
import { Role } from './role'
import { ERoleType } from '../types/permissions.types'

describe(`Role model`, () => {
  describe(`constructor`, () => {
    it(`should create role with default type as member`, () => {
      const role = new Role({ userId: `user-1` })
      expect(role.type).toBe(ERoleType.member)
      expect(role.userId).toBe(`user-1`)
    })

    it(`should create role with specified type`, () => {
      const role = new Role({
        userId: `user-1`,
        type: ERoleType.admin,
        orgId: `org-1`,
      })
      expect(role.type).toBe(ERoleType.admin)
      expect(role.orgId).toBe(`org-1`)
    })

    it(`should assign all provided properties`, () => {
      const role = new Role({
        id: `role-1`,
        userId: `user-1`,
        type: ERoleType.owner,
        orgId: `org-1`,
        projectId: `project-1`,
        name: `Test Role`,
      })
      expect(role.id).toBe(`role-1`)
      expect(role.userId).toBe(`user-1`)
      expect(role.type).toBe(ERoleType.owner)
      expect(role.orgId).toBe(`org-1`)
      expect(role.projectId).toBe(`project-1`)
      expect(role.name).toBe(`Test Role`)
    })
  })

  describe(`hasMinRole`, () => {
    it(`should return true when role type equals required`, () => {
      const role = new Role({ userId: `user-1`, type: ERoleType.admin })
      expect(role.hasMinRole(ERoleType.admin)).toBe(true)
    })

    it(`should return true when role type is higher than required`, () => {
      const role = new Role({ userId: `user-1`, type: ERoleType.owner })
      expect(role.hasMinRole(ERoleType.admin)).toBe(true)
      expect(role.hasMinRole(ERoleType.member)).toBe(true)
      expect(role.hasMinRole(ERoleType.viewer)).toBe(true)
    })

    it(`should return false when role type is lower than required`, () => {
      const role = new Role({ userId: `user-1`, type: ERoleType.member })
      expect(role.hasMinRole(ERoleType.admin)).toBe(false)
      expect(role.hasMinRole(ERoleType.owner)).toBe(false)
    })
  })

  describe(`isAdmin`, () => {
    it(`should return false for viewer`, () => {
      const role = new Role({ userId: `user-1`, type: ERoleType.viewer })
      expect(role.isAdmin()).toBe(false)
    })

    it(`should return false for member`, () => {
      const role = new Role({ userId: `user-1`, type: ERoleType.member })
      expect(role.isAdmin()).toBe(false)
    })

    it(`should return true for admin`, () => {
      const role = new Role({ userId: `user-1`, type: ERoleType.admin })
      expect(role.isAdmin()).toBe(true)
    })

    it(`should return true for owner`, () => {
      const role = new Role({ userId: `user-1`, type: ERoleType.owner })
      expect(role.isAdmin()).toBe(true)
    })

    it(`should return true for super`, () => {
      const role = new Role({ userId: `user-1`, type: ERoleType.super })
      expect(role.isAdmin()).toBe(true)
    })
  })

  describe(`isOwner`, () => {
    it(`should return false for viewer, member, and admin`, () => {
      expect(new Role({ userId: `user-1`, type: ERoleType.viewer }).isOwner()).toBe(false)
      expect(new Role({ userId: `user-1`, type: ERoleType.member }).isOwner()).toBe(false)
      expect(new Role({ userId: `user-1`, type: ERoleType.admin }).isOwner()).toBe(false)
    })

    it(`should return true for owner`, () => {
      const role = new Role({ userId: `user-1`, type: ERoleType.owner })
      expect(role.isOwner()).toBe(true)
    })

    it(`should return true for super`, () => {
      const role = new Role({ userId: `user-1`, type: ERoleType.super })
      expect(role.isOwner()).toBe(true)
    })
  })

  describe(`isSuperAdmin`, () => {
    it(`should return false for all roles except super`, () => {
      expect(new Role({ userId: `user-1`, type: ERoleType.viewer }).isSuperAdmin()).toBe(
        false
      )
      expect(new Role({ userId: `user-1`, type: ERoleType.member }).isSuperAdmin()).toBe(
        false
      )
      expect(new Role({ userId: `user-1`, type: ERoleType.admin }).isSuperAdmin()).toBe(
        false
      )
      expect(new Role({ userId: `user-1`, type: ERoleType.owner }).isSuperAdmin()).toBe(
        false
      )
    })

    it(`should return true only for super`, () => {
      const role = new Role({ userId: `user-1`, type: ERoleType.super })
      expect(role.isSuperAdmin()).toBe(true)
    })
  })

  describe(`role scoping`, () => {
    it(`should allow org-scoped role without project`, () => {
      const role = new Role({
        userId: `user-1`,
        type: ERoleType.admin,
        orgId: `org-1`,
      })
      expect(role.orgId).toBe(`org-1`)
      expect(role.projectId).toBeUndefined()
    })

    it(`should allow project-scoped role`, () => {
      const role = new Role({
        userId: `user-1`,
        type: ERoleType.member,
        projectId: `project-1`,
      })
      expect(role.projectId).toBe(`project-1`)
    })

    it(`should allow both org and project scoped role`, () => {
      const role = new Role({
        userId: `user-1`,
        type: ERoleType.member,
        orgId: `org-1`,
        projectId: `project-1`,
      })
      expect(role.orgId).toBe(`org-1`)
      expect(role.projectId).toBe(`project-1`)
    })
  })
})
