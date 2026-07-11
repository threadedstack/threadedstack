import { describe, it, expect } from 'vitest'
import { splitBy, cleanSplit } from './cleanSplit'

describe(`splitBy`, () => {
  it(`splits by the default comma delimiter`, () => {
    expect(splitBy(`a,b,c`)).toEqual([`a`, `b`, `c`])
  })

  it(`splits by a custom delimiter`, () => {
    expect(splitBy(`a|b|c`, `|`)).toEqual([`a`, `b`, `c`])
  })

  it(`returns an empty array for empty-string input`, () => {
    expect(splitBy(``)).toEqual([])
  })

  it(`returns an empty array for undefined input`, () => {
    expect(splitBy(undefined)).toEqual([])
  })

  it(`returns a single-element array when the delimiter is not present`, () => {
    expect(splitBy(`abc`)).toEqual([`abc`])
  })
})

describe(`cleanSplit`, () => {
  it(`returns an empty array for whitespace-only input`, () => {
    expect(cleanSplit(`   `)).toEqual([])
  })

  it(`returns an empty array for undefined input`, () => {
    expect(cleanSplit(undefined)).toEqual([])
  })

  it(`filters out empty segments between delimiters`, () => {
    expect(cleanSplit(`a,,b`)).toEqual([`a`, `b`])
  })

  it(`trims leading/trailing whitespace on segments in a normal multi-segment case`, () => {
    expect(cleanSplit(` a , b , c `)).toEqual([`a`, `b`, `c`])
  })

  it(`splits by a custom delimiter and still trims/filters`, () => {
    expect(cleanSplit(` a | | b `, `|`)).toEqual([`a`, `b`])
  })
})
