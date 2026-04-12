import type { TParsedEvent } from '@TDM/types'

import { describe, it, expect } from 'vitest'
import { claudeCodeMatchers } from './claudeCode'

const runMatchers = (text: string): TParsedEvent | null => {
  for (const matcher of claudeCodeMatchers) {
    const result = matcher.match(text)
    if (result) return result
  }
  return null
}

describe('claudeCodeMatchers', () => {
  describe('tool call detection', () => {
    it('detects Read tool call', () => {
      const result = runMatchers('⏺ Read src/index.ts')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('tool-call')
      if (result!.type === 'tool-call') {
        expect(result!.tool).toBe('Read')
        expect(result!.target).toBe('src/index.ts')
        expect(result!.status).toBe('running')
      }
    })

    it('detects Edit tool call', () => {
      const result = runMatchers('⏺ Edit src/App.tsx')
      expect(result).not.toBeNull()
      if (result!.type === 'tool-call') {
        expect(result!.tool).toBe('Edit')
        expect(result!.target).toBe('src/App.tsx')
      }
    })

    it('detects Bash tool call', () => {
      const result = runMatchers('⏺ Bash npm install express')
      expect(result).not.toBeNull()
      if (result!.type === 'tool-call') {
        expect(result!.tool).toBe('Bash')
        expect(result!.target).toBe('npm install express')
      }
    })

    it('detects Write tool call', () => {
      const result = runMatchers('⏺ Write src/new-file.ts')
      expect(result).not.toBeNull()
      if (result!.type === 'tool-call') {
        expect(result!.tool).toBe('Write')
      }
    })
  })

  describe('permission detection', () => {
    it('detects y/n permission prompt', () => {
      const result = runMatchers('Allow Edit to src/App.tsx? (y/n)')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('permission')
    })

    it('detects "Do you want to" pattern', () => {
      const result = runMatchers('Do you want to proceed? (y/n)')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('permission')
    })
  })

  describe('error detection', () => {
    it('detects Error: prefix', () => {
      const result = runMatchers('Error: Cannot find module "foo"')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('error')
    })

    it('detects cross mark errors', () => {
      const result = runMatchers('✗ Build failed')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('error')
    })
  })

  describe('prompt detection', () => {
    it('detects > prompt', () => {
      const result = runMatchers('> ')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('prompt-ready')
    })

    it('detects $ shell prompt', () => {
      const result = runMatchers('$ ')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('prompt-ready')
    })
  })

  describe('diff detection', () => {
    it('detects diff additions', () => {
      const result = runMatchers('+ import { useState } from "react"')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('diff')
    })

    it('detects diff removals', () => {
      const result = runMatchers('- import { Component } from "react"')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('diff')
    })
  })

  it('returns null for unrecognized text', () => {
    const result = runMatchers('just some regular output text')
    expect(result).toBeNull()
  })
})
