import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTheme, themed } from './colors'

describe('Theme System', () => {
  const originalEnv = process.env.NO_COLOR

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NO_COLOR
    else process.env.NO_COLOR = originalEnv
  })

  it('getTheme returns dark theme by default', () => {
    const theme = getTheme('dark')
    expect(theme).toBeDefined()
    expect(theme.primary).toBeDefined()
  })

  it('getTheme returns light theme', () => {
    const theme = getTheme('light')
    expect(theme).toBeDefined()
  })

  it('themed applies theme color to text', () => {
    const result = themed('primary', 'hello')
    expect(typeof result).toBe('string')
    expect(result).toContain('hello')
  })

  it('themed returns plain text when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1'
    const result = themed('primary', 'hello')
    expect(result).toBe('hello')
  })
})
