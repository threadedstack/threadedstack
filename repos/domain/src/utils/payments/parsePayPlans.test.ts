import { describe, it, expect } from 'vitest'
import { parsePayPlans } from './parsePayPlans'

describe(`parsePayPlans`, () => {
  describe(`empty/missing input`, () => {
    it(`should return empty objects for empty string`, () => {
      expect(parsePayPlans('')).toEqual({ priceIds: {}, seatPriceIds: {} })
    })

    it(`should return empty objects for undefined`, () => {
      expect(parsePayPlans()).toEqual({ priceIds: {}, seatPriceIds: {} })
    })

    it(`should return empty objects for whitespace only`, () => {
      expect(parsePayPlans('  ')).toEqual({ priceIds: {}, seatPriceIds: {} })
    })
  })

  describe(`valid input`, () => {
    it(`should parse a single plan`, () => {
      expect(parsePayPlans('free=id1')).toEqual({
        priceIds: { free: 'id1' },
        seatPriceIds: {},
      })
    })

    it(`should parse multiple plans`, () => {
      expect(parsePayPlans('free=id1,pro=id2')).toEqual({
        priceIds: { free: 'id1', pro: 'id2' },
        seatPriceIds: {},
      })
    })

    it(`should parse seat price IDs with colon separator`, () => {
      expect(parsePayPlans('pro=price_pro:seat_pro,team=price_team:seat_team')).toEqual({
        priceIds: { pro: 'price_pro', team: 'price_team' },
        seatPriceIds: { pro: 'seat_pro', team: 'seat_team' },
      })
    })

    it(`should handle mixed plans with and without seat prices`, () => {
      expect(
        parsePayPlans('solo=price_solo,pro=price_pro:seat_pro,team=price_team:seat_team')
      ).toEqual({
        priceIds: { solo: 'price_solo', pro: 'price_pro', team: 'price_team' },
        seatPriceIds: { pro: 'seat_pro', team: 'seat_team' },
      })
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
