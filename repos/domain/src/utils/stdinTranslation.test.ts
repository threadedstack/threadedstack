import { describe, it, expect } from 'vitest'
import { translateInteraction } from './stdinTranslation'

const ArrowDown = `\x1b[B`
const ArrowUp = `\x1b[A`
const Enter = `\r`

describe(`translateInteraction`, () => {
  it(`repeats ArrowDown when selectedIndex is greater than currentIndex`, () => {
    expect(
      translateInteraction({ type: `ArrowSelect`, selectedIndex: 3, currentIndex: 1 })
    ).toBe(`${ArrowDown}${ArrowDown}${Enter}`)
  })

  it(`repeats ArrowUp when selectedIndex is less than currentIndex`, () => {
    expect(
      translateInteraction({ type: `ArrowSelect`, selectedIndex: 0, currentIndex: 2 })
    ).toBe(`${ArrowUp}${ArrowUp}${Enter}`)
  })

  it(`returns just Enter when selectedIndex equals currentIndex`, () => {
    expect(
      translateInteraction({ type: `ArrowSelect`, selectedIndex: 2, currentIndex: 2 })
    ).toBe(Enter)
  })

  it(`writes the 1-indexed selection followed by Enter for NumberSelect`, () => {
    expect(translateInteraction({ type: `NumberSelect`, selectedIndex: 0 })).toBe(
      `1${Enter}`
    )
    expect(translateInteraction({ type: `NumberSelect`, selectedIndex: 4 })).toBe(
      `5${Enter}`
    )
  })

  it(`writes 'y' followed by Enter for an approved YesNo`, () => {
    expect(translateInteraction({ type: `YesNo`, approved: true })).toBe(`y${Enter}`)
  })

  it(`writes 'n' followed by Enter for a rejected YesNo`, () => {
    expect(translateInteraction({ type: `YesNo`, approved: false })).toBe(`n${Enter}`)
  })

  it(`writes the text followed by Enter for TextInput`, () => {
    expect(translateInteraction({ type: `TextInput`, text: `hello world` })).toBe(
      `hello world${Enter}`
    )
  })

  it(`returns the raw key unchanged for Keystroke`, () => {
    expect(translateInteraction({ type: `Keystroke`, key: `\x03` })).toBe(`\x03`)
  })
})
