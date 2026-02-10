import { describe, it, expect } from 'vitest'
import { OverrideErr } from './overrideErr'

const DefaultMessage = `This method must be overwritten by child extended class`

describe(`OverrideErr`, () => {
  it(`should set the default message when no message is provided`, () => {
    const err = new OverrideErr()
    expect(err.message).toBe(DefaultMessage)
  })

  it(`should accept a custom message`, () => {
    const err = new OverrideErr(`custom error`)
    expect(err.message).toBe(`custom error`)
  })

  it(`should handle string details by wrapping in an array`, () => {
    const err = new OverrideErr(`msg`, `some detail`)
    expect(err.details).toHaveLength(1)
    expect(err.details[0]).toEqual({ loc: [], msg: `some detail`, type: `` })
  })

  it(`should handle an array of detail objects`, () => {
    const details = [
      { loc: [`a`, `b`], msg: `first`, type: `validation` },
      { loc: [`c`], msg: `second`, type: `type_error` },
    ]
    const err = new OverrideErr(`msg`, details)
    expect(err.details).toHaveLength(2)
    expect(err.details[0]).toEqual(details[0])
    expect(err.details[1]).toEqual(details[1])
  })

  it(`should return just the message from toString() when there are no details`, () => {
    const err = new OverrideErr(`no details here`)
    expect(err.toString()).toBe(`no details here`)
  })

  it(`should return message + detail messages from toString() with detail objects (not [object Object])`, () => {
    const details = [
      { loc: [`field`], msg: `field is required`, type: `validation` },
      { loc: [`name`], msg: `name too long`, type: `validation` },
    ]
    const err = new OverrideErr(`Validation failed`, details)
    const result = err.toString()
    expect(result).not.toContain(`[object Object]`)
    expect(result).toContain(`Validation failed`)
    expect(result).toContain(`field is required`)
    expect(result).toContain(`name too long`)
    expect(result).toBe(`Validation failed
Details: field is required
name too long`)
  })

  it(`should return message + string details from toString()`, () => {
    const err = new OverrideErr(`error`, `a string detail`)
    const result = err.toString()
    expect(result).toContain(`error`)
    expect(result).toContain(`a string detail`)
  })

  it(`should throw an OverrideErr via static throw()`, () => {
    expect(() => OverrideErr.throw(`boom`)).toThrowError(`boom`)
    expect(() => OverrideErr.throw(`boom`)).toThrow(OverrideErr)
  })
})
