import { describe, it, expect } from 'vitest'
import { Exception } from './exception'

describe(`Exception`, () => {
  it(`should create with status and string message`, () => {
    const ex = new Exception(400, `Bad request`)
    expect(ex.status).toBe(400)
    expect(ex.message).toBe(`Bad request`)
    expect(ex.code).toBeUndefined()
    expect(ex.details).toBeUndefined()
    expect(ex).toBeInstanceOf(Error)
    expect(ex.name).toBe(`Exception`)
  })

  it(`should create with status, message, and code`, () => {
    const ex = new Exception(403, `Forbidden`, `FORBIDDEN`)
    expect(ex.status).toBe(403)
    expect(ex.message).toBe(`Forbidden`)
    expect(ex.code).toBe(`FORBIDDEN`)
  })

  it(`should accept Error as message and extract properties`, () => {
    const original = new Error(`Internal error`)
    const ex = new Exception(500, original)
    expect(ex.status).toBe(500)
    expect(ex.message).toBe(`Internal error`)
    expect(ex.stack).toBe(original.stack)
  })

  it(`should extract cause from Error as details`, () => {
    const original = new Error(`fail`)
    original.cause = `upstream timeout`
    const ex = new Exception(502, original)
    expect(ex.details).toEqual([`upstream timeout`])
  })

  it(`should not override explicit details with Error.cause`, () => {
    const original = new Error(`fail`)
    original.cause = `from cause`
    const ex = new Exception(500, original, undefined, [`explicit detail`])
    expect(ex.details).toEqual([`explicit detail`])
  })

  it(`should not override explicit stack with Error.stack`, () => {
    const original = new Error(`fail`)
    const customStack = `custom stack trace`
    const ex = new Exception(500, original, undefined, undefined, customStack)
    expect(ex.stack).toBe(customStack)
  })

  it(`should normalize details to array via ensureArr`, () => {
    const ex = new Exception(400, `Bad`, `CODE`, `single string detail`)
    expect(ex.details).toEqual([`single string detail`])
  })

  it(`should normalize object details to array`, () => {
    const detail = { loc: [`body`, `name`], msg: `required`, type: `missing` }
    const ex = new Exception(422, `Validation`, `VALIDATION`, detail)
    expect(ex.details).toEqual([detail])
  })

  it(`should keep array details as-is`, () => {
    const details = [`error 1`, `error 2`]
    const ex = new Exception(400, `Bad`, undefined, details)
    expect(ex.details).toEqual(details)
  })

  it(`should be throwable via static throw`, () => {
    expect(() => Exception.throw(400, `Bad request`, `BAD_REQUEST`)).toThrow(Exception)
  })

  it(`should have correct properties when thrown via static throw`, () => {
    try {
      Exception.throw(404, `Not found`, `NOT_FOUND`, [`missing resource`])
    } catch (err) {
      expect(err).toBeInstanceOf(Exception)
      const ex = err as Exception
      expect(ex.status).toBe(404)
      expect(ex.message).toBe(`Not found`)
      expect(ex.code).toBe(`NOT_FOUND`)
      expect(ex.details).toEqual([`missing resource`])
    }
  })
})
