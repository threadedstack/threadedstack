import { describe, expect, it } from 'vitest'
import { SandboxAliasMaxLength, slugify, isValidSandboxAlias } from './slugify'

describe(`slugify`, () => {
  it(`should convert basic names to slugs`, () => {
    expect(slugify(`My Sandbox`)).toBe(`my-sandbox`)
  })

  it(`should handle built-in sandbox names`, () => {
    expect(slugify(`Claude Code`)).toBe(`claude-code`)
    expect(slugify(`Antigravity`)).toBe(`antigravity`)
    expect(slugify(`OpenClaw`)).toBe(`openclaw`)
    expect(slugify(`OpenCode`)).toBe(`opencode`)
  })

  it(`should convert underscores to hyphens`, () => {
    expect(slugify(`my_sandbox`)).toBe(`my-sandbox`)
  })

  it(`should strip special characters`, () => {
    expect(slugify(`foo@bar!`)).toBe(`foobar`)
  })

  it(`should collapse consecutive hyphens`, () => {
    expect(slugify(`foo--bar`)).toBe(`foo-bar`)
  })

  it(`should strip leading and trailing hyphens`, () => {
    expect(slugify(`-foo-`)).toBe(`foo`)
  })

  it(`should return empty string for all non-ASCII input`, () => {
    expect(slugify(`日本語`)).toBe(``)
  })

  it(`should return empty string for empty input`, () => {
    expect(slugify(``)).toBe(``)
  })

  it(`should truncate long names to ${SandboxAliasMaxLength} chars`, () => {
    const long = `a`.repeat(100)
    const result = slugify(long)
    expect(result.length).toBeLessThanOrEqual(SandboxAliasMaxLength)
    expect(result).toBe(`a`.repeat(SandboxAliasMaxLength))
  })

  it(`should strip trailing hyphen after truncation`, () => {
    // Build a string that, after slugify processing, has a hyphen at position 63
    // 62 a's + hyphen + more chars = after slice(63) we get 62 a's + hyphen, which should be trimmed
    const name = `a`.repeat(62) + `-` + `b`.repeat(10)
    const result = slugify(name)
    expect(result.length).toBeLessThanOrEqual(SandboxAliasMaxLength)
    expect(result.endsWith(`-`)).toBe(false)
  })

  it(`should convert mixed case to lowercase`, () => {
    expect(slugify(`FOO BAR`)).toBe(`foo-bar`)
  })

  it(`should preserve numbers`, () => {
    expect(slugify(`sandbox-123`)).toBe(`sandbox-123`)
  })

  it(`should pass through an already valid slug`, () => {
    expect(slugify(`my-sandbox`)).toBe(`my-sandbox`)
  })
})

describe(`isValidSandboxAlias`, () => {
  it(`should accept valid aliases`, () => {
    expect(isValidSandboxAlias(`my-sandbox`)).toBe(true)
    expect(isValidSandboxAlias(`a`)).toBe(true)
    expect(isValidSandboxAlias(`a-b-c`)).toBe(true)
    expect(isValidSandboxAlias(`abc123`)).toBe(true)
    expect(isValidSandboxAlias(`a1`)).toBe(true)
    expect(isValidSandboxAlias(`x`)).toBe(true)
  })

  it(`should reject empty string`, () => {
    expect(isValidSandboxAlias(``)).toBe(false)
  })

  it(`should reject alias starting with a hyphen`, () => {
    expect(isValidSandboxAlias(`-foo`)).toBe(false)
  })

  it(`should reject alias ending with a hyphen`, () => {
    expect(isValidSandboxAlias(`foo-`)).toBe(false)
  })

  it(`should reject uppercase characters`, () => {
    expect(isValidSandboxAlias(`FOO`)).toBe(false)
  })

  it(`should reject spaces`, () => {
    expect(isValidSandboxAlias(`foo bar`)).toBe(false)
  })

  it(`should reject underscores`, () => {
    expect(isValidSandboxAlias(`foo_bar`)).toBe(false)
  })

  it(`should reject alias starting with sb_ prefix`, () => {
    expect(isValidSandboxAlias(`sb_test`)).toBe(false)
  })

  it(`should reject alias longer than ${SandboxAliasMaxLength} chars`, () => {
    const tooLong = `a`.repeat(SandboxAliasMaxLength + 1)
    expect(isValidSandboxAlias(tooLong)).toBe(false)
  })

  it(`should accept alias of exactly ${SandboxAliasMaxLength} chars`, () => {
    const exact = `a`.repeat(SandboxAliasMaxLength)
    expect(isValidSandboxAlias(exact)).toBe(true)
  })

  it(`should reject special characters`, () => {
    expect(isValidSandboxAlias(`foo@bar`)).toBe(false)
  })
})
