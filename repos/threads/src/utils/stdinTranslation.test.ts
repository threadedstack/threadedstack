import { describe, it, expect } from 'vitest'
import { translateInteraction } from '@tdsk/domain'

describe('translateInteraction', () => {
  describe('ArrowSelect', () => {
    it('should send enter when selecting current index', () => {
      const result = translateInteraction({
        type: 'ArrowSelect',
        selectedIndex: 0,
        currentIndex: 0,
      })
      expect(result).toBe('\r')
    })

    it('should send down arrows + enter when selecting below current', () => {
      const result = translateInteraction({
        type: 'ArrowSelect',
        selectedIndex: 2,
        currentIndex: 0,
      })
      expect(result).toBe('\x1b[B\x1b[B\r')
    })

    it('should send up arrows + enter when selecting above current', () => {
      const result = translateInteraction({
        type: 'ArrowSelect',
        selectedIndex: 0,
        currentIndex: 2,
      })
      expect(result).toBe('\x1b[A\x1b[A\r')
    })
  })

  describe('NumberSelect', () => {
    it('should send number + enter', () => {
      const result = translateInteraction({ type: 'NumberSelect', selectedIndex: 2 })
      expect(result).toBe('3\r')
    })

    it('should send 1 for first option', () => {
      const result = translateInteraction({ type: 'NumberSelect', selectedIndex: 0 })
      expect(result).toBe('1\r')
    })
  })

  describe('YesNo', () => {
    it('should send y for approve', () => {
      const result = translateInteraction({ type: 'YesNo', approved: true })
      expect(result).toBe('y\r')
    })

    it('should send n for deny', () => {
      const result = translateInteraction({ type: 'YesNo', approved: false })
      expect(result).toBe('n\r')
    })
  })

  describe('TextInput', () => {
    it('should send text + enter', () => {
      const result = translateInteraction({ type: 'TextInput', text: 'hello world' })
      expect(result).toBe('hello world\r')
    })
  })

  describe('Keystroke', () => {
    it('should send the key character', () => {
      const result = translateInteraction({ type: 'Keystroke', key: 'q' })
      expect(result).toBe('q')
    })
  })
})
