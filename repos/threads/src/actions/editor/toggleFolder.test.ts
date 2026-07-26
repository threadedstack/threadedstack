import type { TFileEntry } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetExpandedFolders = vi.fn()
const mockLoadDirectory = vi.fn()

let expandedFolders = new Set<string>()
let fileTreeData = new Map<string, TFileEntry[]>()

vi.mock('@TTH/state/accessors', () => ({
  getExpandedFolders: () => expandedFolders,
  setExpandedFolders: (...args: any[]) => mockSetExpandedFolders(...args),
  getFileTreeData: () => fileTreeData,
}))

vi.mock('@TTH/actions/editor/loadDirectory', () => ({
  loadDirectory: (...args: any[]) => mockLoadDirectory(...args),
}))

import { toggleFolder } from './toggleFolder'

describe(`toggleFolder`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    expandedFolders = new Set()
    fileTreeData = new Map()
    mockLoadDirectory.mockResolvedValue(undefined)
  })

  it(`collapses an already-expanded folder via a new Set and never touches the file tree`, () => {
    const original = new Set([`/src`, `/src/sub`])
    expandedFolders = original

    toggleFolder(`/src/sub`)

    expect(mockSetExpandedFolders).toHaveBeenCalledTimes(1)
    const committed = mockSetExpandedFolders.mock.calls[0][0] as Set<string>
    expect(committed).not.toBe(original)
    expect(committed.has(`/src/sub`)).toBe(false)
    expect(committed.has(`/src`)).toBe(true)
    // the original reference must not be mutated in place.
    expect(original.has(`/src/sub`)).toBe(true)
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })

  it(`expands a collapsed folder via a new Set and loads its directory when data is not cached`, () => {
    const original = new Set([`/src`])
    expandedFolders = original

    toggleFolder(`/src/sub`)

    const committed = mockSetExpandedFolders.mock.calls[0][0] as Set<string>
    expect(committed).not.toBe(original)
    expect(committed.has(`/src/sub`)).toBe(true)
    expect(committed.has(`/src`)).toBe(true)
    expect(original.has(`/src/sub`)).toBe(false)
    expect(mockLoadDirectory).toHaveBeenCalledWith(`/src/sub`)
  })

  it(`expands a collapsed folder but skips loadDirectory when its data is already cached`, () => {
    expandedFolders = new Set()
    fileTreeData = new Map([[`/src/sub`, []]])

    toggleFolder(`/src/sub`)

    expect(mockSetExpandedFolders).toHaveBeenCalled()
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })

  it(`catches a loadDirectory rejection on the expand path via console.warn instead of throwing`, async () => {
    const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
    mockLoadDirectory.mockRejectedValue(new Error(`boom`))

    expect(() => toggleFolder(`/src/sub`)).not.toThrow()
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        `[FileTree] Failed to load /src/sub:`,
        expect.any(Error)
      )
    })

    warnSpy.mockRestore()
  })
})
