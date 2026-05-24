import { describe, it, expect } from 'vitest'
import { parseCron, cronToString, isValidCron } from './cron'
import { ERepeatType } from '@TSC/types'

describe(`cronToString`, () => {
  it(`should generate a minute interval expression`, () => {
    expect(
      cronToString({ days: [], time: `00:00`, repeat: ERepeatType.minute, interval: 5 })
    ).toBe(`*/5 * * * *`)
  })

  it(`should generate an hourly expression`, () => {
    expect(
      cronToString({ days: [], time: `00:30`, repeat: ERepeatType.hourly, interval: 2 })
    ).toBe(`30 */2 * * *`)
  })

  it(`should generate a daily expression`, () => {
    expect(
      cronToString({ days: [], time: `09:15`, repeat: ERepeatType.daily, interval: 1 })
    ).toBe(`15 09 */1 * *`)
  })

  it(`should generate a weekly expression with specific days`, () => {
    expect(
      cronToString({
        days: [`Mon`, `Wed`, `Fri`],
        time: `09:00`,
        repeat: ERepeatType.weekly,
        interval: 1,
      })
    ).toBe(`00 09 * * 1,3,5`)
  })

  it(`should generate a weekly expression with wildcard when no days`, () => {
    expect(
      cronToString({ days: [], time: `09:00`, repeat: ERepeatType.weekly, interval: 1 })
    ).toBe(`00 09 * * *`)
  })

  it(`should generate a monthly expression`, () => {
    expect(
      cronToString({ days: [], time: `08:00`, repeat: ERepeatType.monthly, interval: 3 })
    ).toBe(`00 08 1 */3 *`)
  })

  it(`should generate a yearly expression`, () => {
    expect(
      cronToString({ days: [], time: `12:00`, repeat: ERepeatType.yearly, interval: 1 })
    ).toBe(`00 12 1 1 *`)
  })
})

describe(`parseCron`, () => {
  it(`should return null for invalid expressions`, () => {
    expect(parseCron(``)).toBeNull()
    expect(parseCron(`* * *`)).toBeNull()
    expect(parseCron(`0 * * * * *`)).toBeNull()
  })

  it(`should return null for out-of-range field values`, () => {
    expect(parseCron(`60 0 * * *`)).toBeNull()
    expect(parseCron(`0 24 * * *`)).toBeNull()
    expect(parseCron(`0 0 32 * *`)).toBeNull()
    expect(parseCron(`0 0 0 * *`)).toBeNull()
    expect(parseCron(`0 0 * 13 *`)).toBeNull()
    expect(parseCron(`0 0 * 0 *`)).toBeNull()
    expect(parseCron(`0 0 * * 7`)).toBeNull()
    expect(parseCron(`0 0 12 31 2`)).toBeNull()
  })

  it(`should parse a minute interval expression`, () => {
    const result = parseCron(`*/5 * * * *`)
    expect(result).toEqual({
      days: [],
      repeat: ERepeatType.minute,
      interval: 5,
      time: `00:00`,
    })
  })

  it(`should parse an hourly expression`, () => {
    const result = parseCron(`30 */2 * * *`)
    expect(result).toEqual({
      days: [],
      repeat: ERepeatType.hourly,
      interval: 2,
      time: `00:30`,
    })
  })

  it(`should parse a daily expression`, () => {
    const result = parseCron(`15 09 */1 * *`)
    expect(result).toEqual({
      days: [],
      repeat: ERepeatType.daily,
      interval: 1,
      time: `09:15`,
    })
  })

  it(`should parse a weekly expression with days`, () => {
    const result = parseCron(`00 09 * * 1,3,5`)
    expect(result).toEqual({
      days: [`Mon`, `Wed`, `Fri`],
      repeat: ERepeatType.weekly,
      interval: 1,
      time: `09:00`,
    })
  })

  it(`should parse a monthly expression`, () => {
    const result = parseCron(`00 08 1 */3 *`)
    expect(result).toEqual({
      days: [],
      repeat: ERepeatType.monthly,
      interval: 3,
      time: `08:00`,
    })
  })

  it(`should parse a yearly expression`, () => {
    const result = parseCron(`00 12 1 1 *`)
    expect(result).toEqual({
      days: [],
      repeat: ERepeatType.yearly,
      interval: 1,
      time: `12:00`,
    })
  })
})

describe(`isValidCron`, () => {
  it(`should accept valid expressions`, () => {
    expect(isValidCron(`* * * * *`)).toBe(true)
    expect(isValidCron(`0 9 * * 1-5`)).toBe(true)
    expect(isValidCron(`*/5 * * * *`)).toBe(true)
    expect(isValidCron(`0,30 * * * *`)).toBe(true)
    expect(isValidCron(`0 0 1 1 *`)).toBe(true)
    expect(isValidCron(`0 0 * * 0,6`)).toBe(true)
  })

  it(`should reject invalid field counts`, () => {
    expect(isValidCron(``)).toBe(false)
    expect(isValidCron(`* * *`)).toBe(false)
    expect(isValidCron(`* * * * * *`)).toBe(false)
  })

  it(`should reject out-of-range values`, () => {
    expect(isValidCron(`60 0 * * *`)).toBe(false)
    expect(isValidCron(`0 24 * * *`)).toBe(false)
    expect(isValidCron(`0 0 32 * *`)).toBe(false)
    expect(isValidCron(`0 0 0 * *`)).toBe(false)
    expect(isValidCron(`0 0 * 13 *`)).toBe(false)
    expect(isValidCron(`0 0 * 0 *`)).toBe(false)
    expect(isValidCron(`0 0 * * 7`)).toBe(false)
  })

  it(`should reject invalid step values`, () => {
    expect(isValidCron(`*/0 * * * *`)).toBe(false)
    expect(isValidCron(`*/-1 * * * *`)).toBe(false)
  })

  it(`should reject invalid ranges`, () => {
    expect(isValidCron(`5-2 * * * *`)).toBe(false)
    expect(isValidCron(`0 0 * 5-13 *`)).toBe(false)
  })
})

describe(`round-trip`, () => {
  it(`should round-trip a weekly cron expression`, () => {
    const original = `00 09 * * 1,3,5`
    const parsed = parseCron(original)!
    expect(cronToString(parsed)).toBe(original)
  })

  it(`should round-trip a daily cron expression`, () => {
    const original = `15 09 */1 * *`
    const parsed = parseCron(original)!
    expect(cronToString(parsed)).toBe(original)
  })

  it(`should round-trip a minute cron expression`, () => {
    const original = `*/5 * * * *`
    const parsed = parseCron(original)!
    expect(cronToString(parsed)).toBe(original)
  })
})
