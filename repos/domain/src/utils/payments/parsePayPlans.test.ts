import { describe, it, expect } from 'vitest'
import { parsePayPlans } from './parsePayPlans'

describe(`parsePayPlans`, () => {
  describe(`empty/missing input`, () => {
    it(`should return empty object for empty string`, () => {
      expect(parsePayPlans('')).toEqual({})
    })

    it(`should return empty object for undefined`, () => {
      expect(parsePayPlans()).toEqual({})
    })

    it(`should return empty object for whitespace only`, () => {
      expect(parsePayPlans('  ')).toEqual({})
    })
  })

  describe(`valid input`, () => {
    it(`should parse a single plan`, () => {
      expect(parsePayPlans('free=id1')).toEqual({ free: 'id1' })
    })

    it(`should parse multiple plans`, () => {
      expect(parsePayPlans('free=id1,pro=id2')).toEqual({ free: 'id1', pro: 'id2' })
    })
  })

  describe(`error cases`, () => {
    it(`should throw on missing name`, () => {
      expect(() => parsePayPlans('=id1')).toThrow()
    })

    it(`should throw on missing id`, () => {
      expect(() => parsePayPlans('free=')).toThrow()
    })

    it(`should throw on duplicate name`, () => {
      expect(() => parsePayPlans(`free=id1,free=id2`)).toThrow(/duplicated/)
    })

    it(`should throw on duplicate ID`, () => {
      expect(() => parsePayPlans(`free=id1,pro=id1`)).toThrow(/duplicated/)
    })
  })
})
