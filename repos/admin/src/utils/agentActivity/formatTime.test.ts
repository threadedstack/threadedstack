import { describe, it, expect } from 'vitest'
import { relativeTime, absoluteTime } from './formatTime'

const NOW = Date.parse(`2026-07-25T12:00:00Z`)

describe(`relativeTime`, () => {
  it(`buckets recent times into human units`, () => {
    expect(relativeTime(`2026-07-25T11:59:40Z`, NOW)).toBe(`just now`)
    expect(relativeTime(`2026-07-25T11:57:00Z`, NOW)).toBe(`3m ago`)
    expect(relativeTime(`2026-07-25T10:00:00Z`, NOW)).toBe(`2h ago`)
    expect(relativeTime(`2026-07-22T12:00:00Z`, NOW)).toBe(`3d ago`)
  })

  it(`falls back to an absolute short date past a week`, () => {
    // Not "just now", not a relative bucket — a real month/day label.
    const out = relativeTime(`2026-06-01T12:00:00Z`, NOW)
    expect(out).not.toMatch(/ago|just now/)
    expect(out.length).toBeGreaterThan(0)
  })

  it(`returns empty string for missing or unparseable input, never "Invalid Date"`, () => {
    expect(relativeTime(undefined, NOW)).toBe(``)
    expect(relativeTime(``, NOW)).toBe(``)
    expect(relativeTime(`not-a-date`, NOW)).toBe(``)
  })
})

describe(`absoluteTime`, () => {
  it(`formats a parseable timestamp and empties an unparseable one`, () => {
    expect(absoluteTime(`2026-07-25T12:00:00Z`).length).toBeGreaterThan(0)
    expect(absoluteTime(`nope`)).toBe(``)
    expect(absoluteTime(undefined)).toBe(``)
  })
})
