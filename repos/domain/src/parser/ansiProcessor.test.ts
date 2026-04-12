import { describe, it, expect } from 'vitest'
import { stripAnsi } from './ansiProcessor'

describe('stripAnsi', () => {
  it('returns plain text unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world')
  })

  it('strips SGR color codes', () => {
    expect(stripAnsi('\x1b[31mred text\x1b[0m')).toBe('red text')
  })

  it('strips bold/underline sequences', () => {
    expect(stripAnsi('\x1b[1mbold\x1b[22m \x1b[4munderline\x1b[24m')).toBe(
      'bold underline'
    )
  })

  it('strips cursor movement sequences', () => {
    expect(stripAnsi('\x1b[2J\x1b[H\x1b[3Ahello')).toBe('hello')
  })

  it('strips OSC sequences', () => {
    expect(stripAnsi('\x1b]0;window title\x07some text')).toBe('some text')
  })

  it('strips 256-color and RGB sequences', () => {
    expect(stripAnsi('\x1b[38;5;196mred\x1b[0m \x1b[38;2;255;0;0mrgb\x1b[0m')).toBe(
      'red rgb'
    )
  })

  it('preserves newlines', () => {
    expect(stripAnsi('\x1b[32mline1\n\x1b[33mline2\n')).toBe('line1\nline2\n')
  })

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('')
  })
})
