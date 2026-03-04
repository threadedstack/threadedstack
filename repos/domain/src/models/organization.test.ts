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

  describe(`userRole property`, () => {
    it(`should accept userRole in constructor`, () => {
      const org = new Organization({ name: `Test`, ownerId: `u-1`, userRole: `admin` })
      expect(org.userRole).toBe(`admin`)
    })

    it(`should leave userRole undefined when not provided`, () => {
      const org = new Organization({ name: `Test`, ownerId: `u-1` })
      expect(org.userRole).toBeUndefined()
    })

    it(`should set userRole when provided`, () => {
      const org = new Organization({ userRole: `member` })
      expect(org.userRole).toBe(`member`)
    })

    it(`should accept various role strings`, () => {
      const owner = new Organization({ userRole: `owner` })
      const admin = new Organization({ userRole: `admin` })
      const member = new Organization({ userRole: `member` })
      expect(owner.userRole).toBe(`owner`)
      expect(admin.userRole).toBe(`admin`)
      expect(member.userRole).toBe(`member`)
    })
  })
})
