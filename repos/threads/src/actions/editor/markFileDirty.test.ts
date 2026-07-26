import type { TFileCacheEntry } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetFileContentCache = vi.fn()

let cache = new Map<string, TFileCacheEntry>()

vi.mock('@TTH/state/accessors', () => ({
  getFileContentCache: () => cache,
  setFileContentCache: (...args: any[]) => mockSetFileContentCache(...args),
}))

import { markFileDirty } from './markFileDirty'

describe(`markFileDirty`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cache = new Map()
  })

  it(`no-ops when there is no cache entry for the file`, () => {
    markFileDirty(`/a.ts`, `new content`)

    expect(mockSetFileContentCache).not.toHaveBeenCalled()
  })

  it(`no-ops when the entry is currently loading`, () => {
    cache.set(`/a.ts`, { status: `loading` })

    markFileDirty(`/a.ts`, `new content`)

    expect(mockSetFileContentCache).not.toHaveBeenCalled()
  })

  it(`no-ops when the entry is in an error state`, () => {
    cache.set(`/a.ts`, { status: `error`, error: `disk full` })

    markFileDirty(`/a.ts`, `new content`)

    expect(mockSetFileContentCache).not.toHaveBeenCalled()
  })

  it(`marks a loaded entry dirty with the new content via a new Map`, () => {
    const original = cache
    original.set(`/a.ts`, { status: `loaded`, content: `old content` })

    markFileDirty(`/a.ts`, `new content`)

    expect(mockSetFileContentCache).toHaveBeenCalledTimes(1)
    const committed = mockSetFileContentCache.mock.calls[0][0] as Map<
      string,
      TFileCacheEntry
    >
    expect(committed).not.toBe(original)
    expect(committed.get(`/a.ts`)).toEqual({ status: `dirty`, content: `new content` })
  })

  it(`marks an already-dirty entry dirty with the new content, discarding the previous content`, () => {
    cache.set(`/a.ts`, { status: `dirty`, content: `stale content` })

    markFileDirty(`/a.ts`, `fresh content`)

    const committed = mockSetFileContentCache.mock.calls[0][0] as Map<
      string,
      TFileCacheEntry
    >
    expect(committed.get(`/a.ts`)).toEqual({ status: `dirty`, content: `fresh content` })
  })
})
