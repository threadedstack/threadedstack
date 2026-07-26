import type { TFileCacheEntry } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLoadFileContent = vi.fn()
const mockSetActiveEditorFile = vi.fn()

vi.mock('@TTH/actions/editor/loadFileContent', () => ({
  loadFileContent: (...args: any[]) => mockLoadFileContent(...args),
}))

let cache = new Map<string, TFileCacheEntry>()

vi.mock('@TTH/state/accessors', () => ({
  setActiveEditorFile: (...args: any[]) => mockSetActiveEditorFile(...args),
  getFileContentCache: () => cache,
}))

import { selectEditorFile } from './selectEditorFile'

describe(`selectEditorFile`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cache = new Map()
    mockLoadFileContent.mockResolvedValue(undefined)
  })

  it(`calls loadFileContent on a cache miss`, () => {
    selectEditorFile(`/a.ts`)

    expect(mockLoadFileContent).toHaveBeenCalledWith(`/a.ts`)
  })

  it(`does not call loadFileContent on a cache hit`, () => {
    cache.set(`/a.ts`, { status: `loaded`, content: `v1` })

    selectEditorFile(`/a.ts`)

    expect(mockLoadFileContent).not.toHaveBeenCalled()
  })

  it(`always sets the active editor file first, regardless of cache state`, () => {
    selectEditorFile(`/a.ts`)
    expect(mockSetActiveEditorFile).toHaveBeenCalledWith(`/a.ts`)

    mockSetActiveEditorFile.mockClear()
    cache.set(`/b.ts`, { status: `loaded`, content: `v1` })
    selectEditorFile(`/b.ts`)
    expect(mockSetActiveEditorFile).toHaveBeenCalledWith(`/b.ts`)
  })

  it(`catches a loadFileContent rejection via console.warn instead of throwing`, async () => {
    const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
    mockLoadFileContent.mockRejectedValue(new Error(`boom`))

    expect(() => selectEditorFile(`/a.ts`)).not.toThrow()
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        `[Editor] Failed to load /a.ts:`,
        expect.any(Error)
      )
    })

    warnSpy.mockRestore()
  })
})
