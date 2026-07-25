import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  generateInvitationToken,
  getInvitationExpiration,
} from './generateInvitationToken'

describe(`generateInvitationToken`, () => {
  it(`returns a string matching the base64url charset`, () => {
    expect(generateInvitationToken()).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it(`returns a different value on each call`, () => {
    expect(generateInvitationToken()).not.toBe(generateInvitationToken())
  })

  it(`decodes to exactly 32 bytes`, () => {
    const token = generateInvitationToken()
    expect(Buffer.from(token, `base64url`).length).toBe(32)
  })
})

describe(`getInvitationExpiration`, () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it(`with no args, resolves to exactly 7 days later`, () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`2026-01-01T00:00:00.000Z`))

    expect(getInvitationExpiration()).toBe(`2026-01-08T00:00:00.000Z`)
  })

  it(`with days=1, resolves to exactly 1 day later`, () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`2026-01-01T00:00:00.000Z`))

    expect(getInvitationExpiration(1)).toBe(`2026-01-02T00:00:00.000Z`)
  })

  it(`with days=0, resolves to the same day`, () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`2026-01-01T00:00:00.000Z`))

    expect(getInvitationExpiration(0)).toBe(`2026-01-01T00:00:00.000Z`)
  })

  it(`correctly rolls over a month/year boundary`, () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`2026-12-30T00:00:00.000Z`))

    expect(getInvitationExpiration(5)).toBe(`2027-01-04T00:00:00.000Z`)
  })
})
