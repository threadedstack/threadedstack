import { describe, it, expect } from 'vitest'
import { parseStatusFilter } from './parseStatusFilter'

describe(`parseStatusFilter`, () => {
  const validStatuses = new Set([`pending`, `verified`, `regressed`])

  it(`returns undefined when status is absent`, () => {
    expect(parseStatusFilter(undefined, validStatuses)).toBeUndefined()
  })

  it(`returns undefined when status is not a string (e.g. array from repeated query params)`, () => {
    expect(parseStatusFilter([`pending`, `verified`], validStatuses)).toBeUndefined()
  })

  it(`returns the value when it is a valid status`, () => {
    expect(parseStatusFilter(`verified`, validStatuses)).toBe(`verified`)
  })

  it(`throws a 400 Exception when status is not in the valid set`, () => {
    expect(() => parseStatusFilter(`bogus`, validStatuses)).toThrow(
      `status must be one of: pending, verified, regressed`
    )
  })

  it(`includes status: 400 on the thrown error`, () => {
    try {
      parseStatusFilter(`bogus`, validStatuses)
      expect.fail(`Expected to throw`)
    } catch (err: any) {
      expect(err.status).toBe(400)
    }
  })

  it(`lists all valid statuses in the error message`, () => {
    try {
      parseStatusFilter(`bogus`, validStatuses)
      expect.fail(`Expected to throw`)
    } catch (err: any) {
      expect(err.message).toContain(`pending`)
      expect(err.message).toContain(`verified`)
      expect(err.message).toContain(`regressed`)
    }
  })
})
