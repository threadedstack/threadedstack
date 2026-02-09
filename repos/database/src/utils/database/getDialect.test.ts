import { describe, it, expect } from 'vitest'
import { EDBDialects } from '@TDB/types'
import { getDialect } from './getDialect'

describe(`getDialect`, () => {
  it(`should return the correct dialect when config.dialect matches an EDBDialects key`, () => {
    expect(getDialect({ dialect: `postgresql` })).toBe(`postgresql`)
    expect(getDialect({ dialect: `mysql` })).toBe(`mysql`)
    expect(getDialect({ dialect: `sqlite` })).toBe(`sqlite`)
    expect(getDialect({ dialect: `turso` })).toBe(`turso`)
    expect(getDialect({ dialect: `gel` })).toBe(`gel`)
    expect(getDialect({ dialect: `singlestore` })).toBe(`singlestore`)
  })

  it(`should resolve postgres alias to postgresql`, () => {
    expect(getDialect({ dialect: `postgres` })).toBe(`postgresql`)
    expect(getDialect({ dialect: `pg` })).toBe(`postgresql`)
  })

  it(`should fall back to config.proto when dialect does not match`, () => {
    expect(getDialect({ dialect: `unknown` as any, proto: `mysql` })).toBe(`mysql`)
    expect(getDialect({ proto: `sqlite` })).toBe(`sqlite`)
  })

  it(`should return postgresql as default when both dialect and proto are missing`, () => {
    expect(getDialect({})).toBe(`postgresql`)
  })

  it(`should return postgresql as default when both dialect and proto are invalid`, () => {
    expect(getDialect({ dialect: `invalid` as any, proto: `nope` as any })).toBe(
      `postgresql`
    )
  })

  it(`should return postgresql when dialect is undefined and proto is undefined`, () => {
    expect(getDialect({ dialect: undefined, proto: undefined })).toBe(`postgresql`)
  })
})
