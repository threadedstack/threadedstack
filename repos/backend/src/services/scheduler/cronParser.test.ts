import { describe, it, expect } from 'vitest'
import { isValidCron, parseNextRun } from './cronParser'

/**
 * Helper to create a Date in local time.
 * The cron parser uses local-time accessors (getHours, getMinutes, etc.)
 * so test dates must be constructed in local time.
 */
const localDate = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
) => new Date(year, month - 1, day, hour, minute, second)

// ── IS VALID CRON ────────────────────────────────────────────────────

describe(`isValidCron`, () => {
  it(`should accept every-minute wildcard`, () => {
    expect(isValidCron(`* * * * *`)).toBe(true)
  })

  it(`should accept specific time with named day`, () => {
    expect(isValidCron(`0 9 * * MON`)).toBe(true)
  })

  it(`should accept step values`, () => {
    expect(isValidCron(`*/5 * * * *`)).toBe(true)
  })

  it(`should accept comma-separated values`, () => {
    expect(isValidCron(`0,30 * * * *`)).toBe(true)
  })

  it(`should accept range with weekday range`, () => {
    expect(isValidCron(`0 9-17 * * 1-5`)).toBe(true)
  })

  it(`should accept named months`, () => {
    expect(isValidCron(`0 0 1 JAN *`)).toBe(true)
  })

  it(`should reject empty string`, () => {
    expect(isValidCron(``)).toBe(false)
  })

  it(`should reject too few fields`, () => {
    expect(isValidCron(`* * *`)).toBe(false)
  })

  it(`should reject too many fields`, () => {
    expect(isValidCron(`* * * * * *`)).toBe(false)
  })

  it(`should reject single field`, () => {
    expect(isValidCron(`5`)).toBe(false)
  })

  it(`should reject whitespace only`, () => {
    expect(isValidCron(`   `)).toBe(false)
  })
})

// ── PARSE NEXT RUN ──────────────────────────────────────────────────

describe(`parseNextRun`, () => {
  it(`every minute - next run should be within 1-2 minutes of from`, () => {
    const from = localDate(2026, 3, 1, 10, 0)
    const next = parseNextRun(`* * * * *`, from)

    expect(next.getTime()).toBeGreaterThan(from.getTime())
    const diffMs = next.getTime() - from.getTime()
    expect(diffMs).toBeLessThanOrEqual(2 * 60 * 1000)
  })

  it(`specific time 30 14 - should be 2:30 PM today or tomorrow`, () => {
    const from = localDate(2026, 3, 1, 6, 0)
    const next = parseNextRun(`30 14 * * *`, from)

    expect(next.getMinutes()).toBe(30)
    expect(next.getHours()).toBe(14)
    expect(next.getDate()).toBe(1)
    expect(next.getMonth()).toBe(2) // March (0-indexed)
  })

  it(`specific time 30 14 - should be tomorrow if past that time today`, () => {
    const from = localDate(2026, 3, 1, 15, 0)
    const next = parseNextRun(`30 14 * * *`, from)

    expect(next.getMinutes()).toBe(30)
    expect(next.getHours()).toBe(14)
    expect(next.getDate()).toBe(2)
  })

  it(`step values - should be at a 15-minute boundary`, () => {
    const from = localDate(2026, 3, 1, 10, 3)
    const next = parseNextRun(`*/15 * * * *`, from)

    expect([0, 15, 30, 45]).toContain(next.getMinutes())
    expect(next.getTime()).toBeGreaterThan(from.getTime())
  })

  it(`day of week MON - should be next Monday at 9am`, () => {
    // 2026-03-01 is a Sunday (day 0)
    const from = localDate(2026, 3, 1, 8, 0)
    const next = parseNextRun(`0 9 * * MON`, from)

    expect(next.getDay()).toBe(1) // Monday
    expect(next.getHours()).toBe(9)
    expect(next.getMinutes()).toBe(0)
    expect(next.getDate()).toBe(2)
  })

  it(`comma values - should pick next matching hour`, () => {
    const from = localDate(2026, 3, 1, 10, 0)
    const next = parseNextRun(`0 9,17 * * *`, from)

    // After 10:00, next match is 17:00
    expect(next.getHours()).toBe(17)
    expect(next.getMinutes()).toBe(0)
    expect(next.getDate()).toBe(1)
  })

  it(`from parameter respected - different from dates produce different results`, () => {
    const from1 = localDate(2026, 3, 1, 10, 0)
    const from2 = localDate(2026, 3, 15, 10, 0)

    const next1 = parseNextRun(`0 12 * * *`, from1)
    const next2 = parseNextRun(`0 12 * * *`, from2)

    expect(next1.getHours()).toBe(12)
    expect(next2.getHours()).toBe(12)
    expect(next1.getDate()).toBe(1)
    expect(next2.getDate()).toBe(15)
  })

  it(`range expression in hour field`, () => {
    const from = localDate(2026, 3, 1, 8, 30)
    const next = parseNextRun(`0 9-11 * * *`, from)

    expect(next.getHours()).toBe(9)
    expect(next.getMinutes()).toBe(0)
  })

  it(`defaults to now when no from is provided`, () => {
    const before = new Date()
    const next = parseNextRun(`* * * * *`)

    expect(next.getTime()).toBeGreaterThanOrEqual(before.getTime())
    const diffMs = next.getTime() - before.getTime()
    expect(diffMs).toBeLessThanOrEqual(2 * 60 * 1000)
  })
})
