import { describe, it, expect } from 'vitest'
import { DBError, DBIdError, DBValueError } from './error'

describe(`DBError`, () => {
  it(`should set message from constructor`, () => {
    const error = new DBError(`something went wrong`)
    expect(error.message).toBe(`something went wrong`)
  })

  it(`should be instanceof Error`, () => {
    const error = new DBError(`test`)
    expect(error).toBeInstanceOf(Error)
  })

  it(`should throw with default message via static throw`, () => {
    expect(() => DBError.throw()).toThrow(`A database error occurred`)
  })

  it(`should throw with custom message via static throw`, () => {
    expect(() => DBError.throw(`custom error`)).toThrow(`custom error`)
  })
})

describe(`DBIdError`, () => {
  it(`should have correct default message about ID field`, () => {
    const error = new DBIdError()
    expect(error.message).toBe(`Update requires an ID field in the data object.`)
  })

  it(`should accept a custom message`, () => {
    const error = new DBIdError(`missing identifier`)
    expect(error.message).toBe(`missing identifier`)
  })

  it(`should be instanceof DBError`, () => {
    const error = new DBIdError()
    expect(error).toBeInstanceOf(DBError)
  })

  it(`should be instanceof Error`, () => {
    const error = new DBIdError()
    expect(error).toBeInstanceOf(Error)
  })
})

describe(`DBValueError`, () => {
  it(`should construct message with method name`, () => {
    const error = new DBValueError(`findById`)
    expect(error.message).toBe(
      `A value is required when calling the findById db service method.`
    )
  })

  it(`should use "this" when method name is not provided`, () => {
    const error = new DBValueError()
    expect(error.message).toBe(`A value is required when calling this db service method.`)
  })

  it(`should use custom message directly when provided`, () => {
    const error = new DBValueError(`someMethod`, `custom value error`)
    expect(error.message).toBe(`custom value error`)
  })

  it(`should be instanceof DBError`, () => {
    const error = new DBValueError()
    expect(error).toBeInstanceOf(DBError)
  })

  it(`should be instanceof Error`, () => {
    const error = new DBValueError()
    expect(error).toBeInstanceOf(Error)
  })
})
