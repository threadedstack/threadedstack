import { describe, it, expect } from 'vitest'
import { Exception } from './exception'

describe(`Exception`, () => {
  it(`should create with status and string message`, () => {
    const ex = new Exception(400, `Bad request`)
    expect(ex.status).toBe(400)
    expect(ex.message).toBe(`Bad request`)
    expect(ex.code).toBeUndefined()
    expect(ex).toBeInstanceOf(Error)
  })

  it(`should create with status, message, and code`, () => {
    const ex = new Exception(403, `Forbidden`, `FORBIDDEN`)
    expect(ex.status).toBe(403)
    expect(ex.message).toBe(`Forbidden`)
    expect(ex.code).toBe(`FORBIDDEN`)
  })

  it(`should accept error object as message`, () => {
    const ex = new Exception(500, { message: `Internal error`, code: `INTERNAL` })
    expect(ex.status).toBe(500)
    expect(ex.message).toBe(`Internal error`)
    expect(ex.code).toBe(`INTERNAL`)
  })

  it(`should preserve stack from error object`, () => {
    const stack = `Error: test\n    at Object.<anonymous>`
    const ex = new Exception(500, { message: `test`, stack })
    expect(ex.stack).toBe(stack)
  })

  it(`should use code parameter when error object has no code`, () => {
    const ex = new Exception(500, { message: `test` }, `FALLBACK`)
    expect(ex.code).toBe(`FALLBACK`)
  })

  it(`should prefer error object code over parameter code`, () => {
    const ex = new Exception(500, { message: `test`, code: `FROM_OBJ` }, `FROM_PARAM`)
    expect(ex.code).toBe(`FROM_OBJ`)
  })

  it(`should be throwable via static throw`, () => {
    expect(() => Exception.throw(400, `Bad request`, `BAD_REQUEST`)).toThrow(Exception)
  })

  it(`should have correct properties when thrown via static throw`, () => {
    try {
      Exception.throw(404, `Not found`, `NOT_FOUND`)
    } catch (err) {
      expect(err).toBeInstanceOf(Exception)
      expect((err as Exception).status).toBe(404)
      expect((err as Exception).message).toBe(`Not found`)
      expect((err as Exception).code).toBe(`NOT_FOUND`)
    }
  })
})
