import { describe, it, expect } from 'vitest'
import {
  InterpreterSystem,
  InteractivePatterns,
  ComponentRegistry,
  AllowedHtmlElements,
  BypassEventTypes,
  BufferedEventTypes,
} from './gui'

describe('GUI constants', () => {
  describe('InterpreterSystem', () => {
    it('should be a non-empty string', () => {
      expect(typeof InterpreterSystem).toBe('string')
      expect(InterpreterSystem.length).toBeGreaterThan(100)
    })

    it('should reference all registry components', () => {
      for (const name of ComponentRegistry) {
        expect(InterpreterSystem).toContain(name)
      }
    })
  })

  describe('InteractivePatterns', () => {
    it('should detect numbered lists', () => {
      const text = '1. Option one\n2. Option two'
      expect(InteractivePatterns.some((p) => p.test(text))).toBe(true)
    })

    it('should detect bulleted lists', () => {
      const text = '- First choice\n- Second choice'
      expect(InteractivePatterns.some((p) => p.test(text))).toBe(true)
    })

    it('should detect cursor markers', () => {
      const text = '❯ Dark mode'
      expect(InteractivePatterns.some((p) => p.test(text))).toBe(true)
    })

    it('should detect confirmation prompts', () => {
      const text = 'Continue? (y/n)'
      expect(InteractivePatterns.some((p) => p.test(text))).toBe(true)
    })

    it('should detect action prompts', () => {
      const text = 'Allow Edit to src/index.ts?'
      expect(InteractivePatterns.some((p) => p.test(text))).toBe(true)
    })

    it('should NOT match plain prose', () => {
      const text = 'This is just a paragraph of text with no interactive elements.'
      expect(InteractivePatterns.some((p) => p.test(text))).toBe(false)
    })
  })

  describe('ComponentRegistry', () => {
    it('should contain v1 components', () => {
      expect(ComponentRegistry).toContain('Select')
      expect(ComponentRegistry).toContain('Confirm')
      expect(ComponentRegistry).toContain('TextInput')
      expect(ComponentRegistry).toContain('Alert')
      expect(ComponentRegistry).toContain('ProgressBar')
    })
  })

  describe('AllowedHtmlElements', () => {
    it('should contain standard HTML elements', () => {
      expect(AllowedHtmlElements).toContain('div')
      expect(AllowedHtmlElements).toContain('p')
      expect(AllowedHtmlElements).toContain('span')
      expect(AllowedHtmlElements).toContain('strong')
    })
  })

  describe('Event type classification', () => {
    it('should have non-overlapping bypass and buffered sets', () => {
      for (const t of BypassEventTypes) {
        expect(BufferedEventTypes).not.toContain(t)
      }
    })
  })
})
