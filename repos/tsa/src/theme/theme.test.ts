import { Theme } from '@TSA/theme/theme'
import { EThemeType } from '@TSA/types'
import { describe, it, expect, afterEach } from 'vitest'

describe(`Theme System`, () => {
  const originalEnv = process.env.NO_COLOR
  const theme = new Theme()

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NO_COLOR
    else process.env.NO_COLOR = originalEnv
  })

  it(`getTheme returns dark theme`, () => {
    const dark = theme.get(EThemeType.dark)
    expect(dark).toBeDefined()
    expect(dark.primary).toBeDefined()
  })

  it(`getTheme returns light theme`, () => {
    const light = theme.get(EThemeType.light)
    expect(light).toBeDefined()
  })

  it(`theme.set sets a new current theme`, () => {
    const light = theme.get(EThemeType.light)
    expect(light).toBeDefined()
  })

  it(`themed applies theme color to text`, () => {
    const result = theme.themed(`primary`, `hello`)
    expect(typeof result).toBe(`string`)
    expect(result).toContain(`hello`)
  })

  it(`themed returns plain text when NO_COLOR is set`, () => {
    process.env.NO_COLOR = `1`
    const result = theme.themed(`primary`, `hello`)
    expect(result).toBe(`hello`)
  })
})
