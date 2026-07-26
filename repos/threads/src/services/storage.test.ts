import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EThemeType } from '@TTH/types'
import { storage } from './storage'

describe(`Storage (threads)`, () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  describe(`headers`, () => {
    it(`round-trips an object through JSON stringify/parse`, () => {
      storage.setHeaders({ Authorization: `Bearer tok-1` })

      expect(storage.getHeaders()).toEqual({ Authorization: `Bearer tok-1` })
    })

    it(`returns undefined when nothing is stored`, () => {
      expect(storage.getHeaders()).toBeUndefined()
    })

    it(`removeHeaders clears the stored value`, () => {
      storage.setHeaders({ Authorization: `Bearer tok-1` })
      storage.removeHeaders()

      expect(storage.getHeaders()).toBeUndefined()
    })
  })

  describe(`theme type`, () => {
    it(`round-trips a raw (non-JSON) string value`, () => {
      storage.setThemeType(EThemeType.dark)

      expect(storage.getThemeType()).toBe(EThemeType.dark)
    })

    it(`removeThemeType clears the stored value`, () => {
      storage.setThemeType(EThemeType.light)
      storage.removeThemeType()

      expect(storage.getThemeType()).toBeUndefined()
    })
  })

  describe(`sandbox nav-expanded state`, () => {
    it(`setSBExpanded(true) then getSBExpanded returns true`, () => {
      storage.setSBExpanded(`sb-1`, true)

      expect(storage.getSBExpanded(`sb-1`)).toBe(true)
    })

    it(`setSBExpanded(false) then getSBExpanded returns false`, () => {
      storage.setSBExpanded(`sb-1`, false)

      expect(storage.getSBExpanded(`sb-1`)).toBe(false)
    })

    it(`returns false for a sandboxId that was never set`, () => {
      expect(storage.getSBExpanded(`never-set`)).toBe(false)
    })

    it(`gives two different sandboxIds independent, non-colliding storage keys`, () => {
      storage.setSBExpanded(`sb-1`, true)
      storage.setSBExpanded(`sb-2`, false)

      expect(storage.getSBExpanded(`sb-1`)).toBe(true)
      expect(storage.getSBExpanded(`sb-2`)).toBe(false)
    })
  })
})
