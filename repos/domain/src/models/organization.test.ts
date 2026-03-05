import { describe, it, expect } from 'vitest'
import { Organization } from './organization'

describe(`Organization model`, () => {
  describe(`constructor`, () => {
    it(`should assign name and ownerId`, () => {
      const org = new Organization({ name: `Acme Corp`, ownerId: `user-1` })
      expect(org.name).toBe(`Acme Corp`)
      expect(org.ownerId).toBe(`user-1`)
    })

    it(`should assign description when provided`, () => {
      const org = new Organization({ description: `A test org` })
      expect(org.description).toBe(`A test org`)
    })

    it(`should leave description undefined when not provided`, () => {
      const org = new Organization({ name: `Minimal` })
      expect(org.description).toBeUndefined()
    })
  })

  describe(`TOrgWithRole response type`, () => {
    it(`should support spreading userRole onto org for API responses`, () => {
      const org = new Organization({ name: `Test`, ownerId: `u-1` })
      const orgWithRole = { ...org, userRole: `admin` as const }
      expect(orgWithRole.userRole).toBe(`admin`)
      expect(orgWithRole.name).toBe(`Test`)
    })

    it(`should not have userRole as an intrinsic property`, () => {
      const org = new Organization({ name: `Test`, ownerId: `u-1` })
      expect(`userRole` in org).toBe(false)
    })
  })
})
