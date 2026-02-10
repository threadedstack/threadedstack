import { describe, it, expect } from 'vitest'
import { User } from './user'

describe(`User model`, () => {
  describe(`constructor`, () => {
    it(`should parse "John Smith" into first="John", last="Smith"`, () => {
      const user = new User({ name: `John Smith` })
      expect(user.first).toBe(`John`)
      expect(user.last).toBe(`Smith`)
    })

    it(`should parse "John Paul Smith" into first="John", last="Paul Smith"`, () => {
      const user = new User({ name: `John Paul Smith` })
      expect(user.first).toBe(`John`)
      expect(user.last).toBe(`Paul Smith`)
    })

    it(`should handle single word name`, () => {
      const user = new User({ name: `John` })
      expect(user.first).toBe(`John`)
      expect(user.last).toBe(``)
    })

    it(`should use provided first/last over name parsing if both exist`, () => {
      const user = new User({ name: `Jane Doe`, first: `Custom`, last: `Name` })
      expect(user.first).toBe(`Custom`)
      expect(user.last).toBe(`Name`)
    })

    it(`should handle undefined name gracefully`, () => {
      const user = new User({})
      expect(user.first).toBeUndefined()
      expect(user.last).toBeUndefined()
    })

    it(`should allow first and last to be undefined after DB round-trip`, () => {
      const user = new User({ email: `test@example.com` })
      expect(user.first).toBeUndefined()
      expect(user.last).toBeUndefined()
    })

    it(`should allow image to be optional`, () => {
      const user = new User({ name: `Test` })
      expect(user.image).toBeUndefined()
    })
  })

  describe(`displayName`, () => {
    it(`should return name if set`, () => {
      const user = new User({ name: `Full Name`, first: `First`, last: `Last` })
      expect(user.displayName).toBe(`Full Name`)
    })

    it(`should return "John Smith" from first+last`, () => {
      const user = new User({ first: `John`, last: `Smith` })
      expect(user.displayName).toBe(`John Smith`)
    })

    it(`should return "John" when only first is set (not "John undefined")`, () => {
      const user = new User({ first: `John` })
      expect(user.displayName).toBe(`John`)
      expect(user.displayName).not.toContain(`undefined`)
    })

    it(`should return empty string when no name/first/last`, () => {
      const user = new User({})
      expect(user.displayName).toBe(``)
    })
  })
})
