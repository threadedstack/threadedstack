import { describe, it, expect } from 'vitest'
import {
  TerminalThemePresets,
  TerminalCursorStyles,
  TerminalFontOptions,
  TerminalFontSizeRange,
  DefaultTerminalSettings,
  TerminalScrollbackRange,
  TerminalSmoothScrollRange,
} from '@TTH/constants/terminal'
import { validateTerminal } from './validate'

const validFontFamily = TerminalFontOptions[1]!.value
const validCursorStyle = TerminalCursorStyles[1]!.value
const validThemePresetKey = Object.keys(TerminalThemePresets)[1]!

describe(`validateTerminal`, () => {
  describe(`numeric clamped fields (fontSize, scrollback, smoothScrollDuration)`, () => {
    it(`clamps a non-numeric fontSize to the range min`, () => {
      expect(validateTerminal({ fontSize: `abc` as any }).fontSize).toBe(
        TerminalFontSizeRange.min
      )
      expect(validateTerminal({ fontSize: undefined as any }).fontSize).toBe(
        TerminalFontSizeRange.min
      )
    })

    it(`clamps a below-min fontSize up to the range min`, () => {
      expect(validateTerminal({ fontSize: TerminalFontSizeRange.min - 5 }).fontSize).toBe(
        TerminalFontSizeRange.min
      )
    })

    it(`clamps an above-max fontSize down to the range max`, () => {
      expect(validateTerminal({ fontSize: TerminalFontSizeRange.max + 5 }).fontSize).toBe(
        TerminalFontSizeRange.max
      )
    })

    it(`passes an in-range fontSize through unchanged`, () => {
      const midpoint = Math.floor(
        (TerminalFontSizeRange.min + TerminalFontSizeRange.max) / 2
      )
      expect(validateTerminal({ fontSize: midpoint }).fontSize).toBe(midpoint)
    })

    it(`clamps scrollback the same way`, () => {
      expect(validateTerminal({ scrollback: `abc` as any }).scrollback).toBe(
        TerminalScrollbackRange.min
      )
      expect(
        validateTerminal({ scrollback: TerminalScrollbackRange.min - 500 }).scrollback
      ).toBe(TerminalScrollbackRange.min)
      expect(
        validateTerminal({ scrollback: TerminalScrollbackRange.max + 500 }).scrollback
      ).toBe(TerminalScrollbackRange.max)
      const mid = Math.floor(
        (TerminalScrollbackRange.min + TerminalScrollbackRange.max) / 2
      )
      expect(validateTerminal({ scrollback: mid }).scrollback).toBe(mid)
    })

    it(`clamps smoothScrollDuration the same way`, () => {
      expect(
        validateTerminal({ smoothScrollDuration: `abc` as any }).smoothScrollDuration
      ).toBe(TerminalSmoothScrollRange.min)
      expect(
        validateTerminal({ smoothScrollDuration: TerminalSmoothScrollRange.min - 50 })
          .smoothScrollDuration
      ).toBe(TerminalSmoothScrollRange.min)
      expect(
        validateTerminal({ smoothScrollDuration: TerminalSmoothScrollRange.max + 50 })
          .smoothScrollDuration
      ).toBe(TerminalSmoothScrollRange.max)
    })
  })

  describe(`allow-listed fields (fontFamily, cursorStyle)`, () => {
    it(`passes a listed fontFamily through`, () => {
      expect(validateTerminal({ fontFamily: validFontFamily }).fontFamily).toBe(
        validFontFamily
      )
    })

    it(`falls back to the default fontFamily when the value is not in the allow-list`, () => {
      expect(validateTerminal({ fontFamily: `Comic Sans` }).fontFamily).toBe(
        DefaultTerminalSettings.fontFamily
      )
    })

    it(`passes a listed cursorStyle through`, () => {
      expect(validateTerminal({ cursorStyle: validCursorStyle }).cursorStyle).toBe(
        validCursorStyle
      )
    })

    it(`falls back to the default cursorStyle when the value is not in the allow-list`, () => {
      expect(validateTerminal({ cursorStyle: `blink` as any }).cursorStyle).toBe(
        DefaultTerminalSettings.cursorStyle
      )
    })
  })

  describe(`themePreset`, () => {
    it(`passes a TerminalThemePresets key through`, () => {
      expect(
        validateTerminal({ themePreset: validThemePresetKey as any }).themePreset
      ).toBe(validThemePresetKey)
    })

    it(`passes the literal 'custom' through even though it is not a TerminalThemePresets key`, () => {
      expect(validateTerminal({ themePreset: `custom` }).themePreset).toBe(`custom`)
    })

    it(`falls back to the default themePreset for an arbitrary string`, () => {
      expect(validateTerminal({ themePreset: `not-a-preset` as any }).themePreset).toBe(
        DefaultTerminalSettings.themePreset
      )
    })
  })

  describe(`boolean fields (cursorBlink, allowTransparency)`, () => {
    it(`passes true/false through unchanged for cursorBlink`, () => {
      expect(validateTerminal({ cursorBlink: true }).cursorBlink).toBe(true)
      expect(validateTerminal({ cursorBlink: false }).cursorBlink).toBe(false)
    })

    it(`falls back to the default cursorBlink for a non-boolean value`, () => {
      expect(validateTerminal({ cursorBlink: `true` as any }).cursorBlink).toBe(
        DefaultTerminalSettings.cursorBlink
      )
      expect(validateTerminal({ cursorBlink: undefined }).cursorBlink).toBe(
        DefaultTerminalSettings.cursorBlink
      )
    })

    it(`passes true/false through unchanged for allowTransparency`, () => {
      expect(validateTerminal({ allowTransparency: true }).allowTransparency).toBe(true)
      expect(validateTerminal({ allowTransparency: false }).allowTransparency).toBe(false)
    })

    it(`falls back to the default allowTransparency for a non-boolean value`, () => {
      expect(
        validateTerminal({ allowTransparency: `false` as any }).allowTransparency
      ).toBe(DefaultTerminalSettings.allowTransparency)
    })
  })

  describe(`theme`, () => {
    it(`passes a well-formed { background, foreground, ...extra } object through as-is`, () => {
      const theme = { background: `#000`, foreground: `#fff`, cursor: `#f00` }
      expect(validateTerminal({ theme: theme as any }).theme).toEqual(theme)
    })

    it(`falls back to the default theme for an array`, () => {
      expect(validateTerminal({ theme: [] as any }).theme).toEqual(
        DefaultTerminalSettings.theme
      )
    })

    it(`falls back to the default theme for null`, () => {
      expect(validateTerminal({ theme: null as any }).theme).toEqual(
        DefaultTerminalSettings.theme
      )
    })

    it(`falls back to the default theme for a string`, () => {
      expect(validateTerminal({ theme: `not-an-object` as any }).theme).toEqual(
        DefaultTerminalSettings.theme
      )
    })

    it(`falls back to the default theme when background or foreground is missing`, () => {
      expect(validateTerminal({ theme: { foreground: `#fff` } as any }).theme).toEqual(
        DefaultTerminalSettings.theme
      )
      expect(validateTerminal({ theme: { background: `#000` } as any }).theme).toEqual(
        DefaultTerminalSettings.theme
      )
    })
  })

  it(`returns exactly DefaultTerminalSettings for every field when given empty input`, () => {
    expect(validateTerminal({})).toEqual(DefaultTerminalSettings)
  })
})
