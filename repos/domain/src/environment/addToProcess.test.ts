import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { addToProcess } from './addToProcess'

describe(`addToProcess`, () => {
  const envKeys = [`TDSK_TEST_A`, `TDSK_TEST_B`, `TDSK_TEST_C`]
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of envKeys) {
      originalEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
  })

  it(`should add envs that don't already exist`, () => {
    addToProcess({ TDSK_TEST_A: `foo`, TDSK_TEST_B: `bar` })

    expect(process.env.TDSK_TEST_A).toBe(`foo`)
    expect(process.env.TDSK_TEST_B).toBe(`bar`)
  })

  it(`should not overwrite an existing env when force is not set`, () => {
    process.env.TDSK_TEST_A = `existing`

    addToProcess({ TDSK_TEST_A: `new-value` })

    expect(process.env.TDSK_TEST_A).toBe(`existing`)
  })

  it(`should overwrite an existing env when force is true`, () => {
    process.env.TDSK_TEST_A = `existing`

    addToProcess({ TDSK_TEST_A: `new-value` }, { force: true })

    expect(process.env.TDSK_TEST_A).toBe(`new-value`)
  })

  it(`should skip keys listed in ignore, even when force is true`, () => {
    process.env.TDSK_TEST_A = `existing`

    addToProcess(
      { TDSK_TEST_A: `new-value`, TDSK_TEST_B: `bar` },
      { force: true, ignore: [`TDSK_TEST_A`] }
    )

    expect(process.env.TDSK_TEST_A).toBe(`existing`)
    expect(process.env.TDSK_TEST_B).toBe(`bar`)
  })

  it(`should skip null and undefined values`, () => {
    addToProcess({
      TDSK_TEST_A: null,
      TDSK_TEST_B: undefined,
      TDSK_TEST_C: `set`,
    })

    expect(process.env.TDSK_TEST_A).toBeUndefined()
    expect(process.env.TDSK_TEST_B).toBeUndefined()
    expect(process.env.TDSK_TEST_C).toBe(`set`)
  })

  it(`should be a no-op for an empty envs object`, () => {
    addToProcess({})

    for (const key of envKeys) expect(process.env[key]).toBeUndefined()
  })

  it(`should default opts when none are passed`, () => {
    addToProcess({ TDSK_TEST_A: `foo` })

    expect(process.env.TDSK_TEST_A).toBe(`foo`)
  })
})
