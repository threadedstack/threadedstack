import { describe, it, expect } from 'vitest'
import { Invitation } from './invitation'
import { EInviteStatus } from '../types/invitation.types'

describe(`Invitation model`, () => {
  const baseData = {
    id: `inv-1`,
    email: `test@example.com`,
    orgId: `org-1`,
    token: `secret-token-123`,
    roleType: `member`,
    invitedBy: `user-1`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: EInviteStatus.pending as string,
  }

  describe(`constructor`, () => {
    it(`should create invitation with all fields`, () => {
      const inv = new Invitation(baseData)
      expect(inv.id).toBe(`inv-1`)
      expect(inv.email).toBe(`test@example.com`)
      expect(inv.orgId).toBe(`org-1`)
      expect(inv.token).toBe(`secret-token-123`)
      expect(inv.roleType).toBe(`member`)
      expect(inv.invitedBy).toBe(`user-1`)
      expect(inv.status).toBe(EInviteStatus.pending)
    })

    it(`should allow invitedBy to be undefined`, () => {
      const { invitedBy, ...rest } = baseData
      const inv = new Invitation(rest)
      expect(inv.invitedBy).toBeUndefined()
    })

    it(`should set expiresAt when provided`, () => {
      const inv = new Invitation(baseData)
      expect(inv.expiresAt).toBeDefined()
    })
  })

  describe(`sanitize`, () => {
    it(`should strip token field`, () => {
      const inv = new Invitation(baseData)
      const sanitized = inv.sanitize()
      expect(sanitized.token).toBeUndefined()
    })

    it(`should preserve other fields`, () => {
      const inv = new Invitation(baseData)
      const sanitized = inv.sanitize()
      expect(sanitized.id).toBe(`inv-1`)
      expect(sanitized.email).toBe(`test@example.com`)
      expect(sanitized.orgId).toBe(`org-1`)
      expect(sanitized.roleType).toBe(`member`)
      expect(sanitized.invitedBy).toBe(`user-1`)
    })

    it(`should return a new Invitation instance`, () => {
      const inv = new Invitation(baseData)
      const sanitized = inv.sanitize()
      expect(sanitized).toBeInstanceOf(Invitation)
      expect(sanitized).not.toBe(inv)
    })
  })

  describe(`status helpers`, () => {
    it(`isPending returns true for pending non-expired invitation`, () => {
      const inv = new Invitation(baseData)
      expect(inv.isPending()).toBe(true)
    })

    it(`isExpired returns true when expiresAt is in the past`, () => {
      const inv = new Invitation({
        ...baseData,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      })
      expect(inv.isExpired()).toBe(true)
    })

    it(`isAccepted returns true for accepted status`, () => {
      const inv = new Invitation({ ...baseData, status: EInviteStatus.accepted })
      expect(inv.isAccepted()).toBe(true)
    })

    it(`isRevoked returns true for revoked status`, () => {
      const inv = new Invitation({ ...baseData, status: EInviteStatus.revoked })
      expect(inv.isRevoked()).toBe(true)
    })
  })
})
