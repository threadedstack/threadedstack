import { describe, it, expect } from 'vitest'
import { Exception } from '@tdsk/domain'
import { withEx } from './withEx'

describe(`withEx`, () => {
  it(`throws an Exception built from a static array value`, () => {
    const errs = withEx({ foo: [400, `bad`, `FOO`] })

    expect(() => errs.foo()).toThrowError(Exception)

    try {
      errs.foo()
    } catch (err: any) {
      expect(err.status).toBe(400)
      expect(err.message).toBe(`bad`)
      expect(err.code).toBe(`FOO-0`)
    }
  })

  it(`throws an Exception built from a function value, called with args`, () => {
    const errs = withEx({
      foo: (name?: string) => [404, `not found: ${name}`, `NF`],
    })

    try {
      errs.foo(`x`)
      throw new Error(`should have thrown`)
    } catch (err: any) {
      expect(err).toBeInstanceOf(Exception)
      expect(err.status).toBe(404)
      expect(err.message).toBe(`not found: x`)
      expect(err.code).toBe(`NF-0`)
    }
  })

  it(`falls back to the outer codeKey when an item omits its own code`, () => {
    const errs = withEx({ foo: [400, `bad`] }, `myKey`)

    try {
      errs.foo()
      throw new Error(`should have thrown`)
    } catch (err: any) {
      expect(err.code).toBe(`myKey-0`)
    }
  })

  it(`uses each item's own index in Object.entries order for its code`, () => {
    const errs = withEx({
      first: [400, `first bad`],
      second: [401, `second bad`],
      third: [402, `third bad`],
    })

    try {
      errs.first()
      throw new Error(`should have thrown`)
    } catch (err: any) {
      expect(err.code).toBe(`err-0`)
    }

    try {
      errs.second()
      throw new Error(`should have thrown`)
    } catch (err: any) {
      expect(err.code).toBe(`err-1`)
    }

    try {
      errs.third()
      throw new Error(`should have thrown`)
    } catch (err: any) {
      expect(err.code).toBe(`err-2`)
    }
  })

  it(`defaults codeKey to "err" when withEx is called without a second arg`, () => {
    const errs = withEx({ foo: [400, `bad`] })

    try {
      errs.foo()
      throw new Error(`should have thrown`)
    } catch (err: any) {
      expect(err.code).toBe(`err-0`)
    }
  })
})
