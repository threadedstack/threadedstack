import type { TFileCtx, TFileEntry } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockToastError = vi.fn()
const mockListDir = vi.fn()
const mockGetFileCtx = vi.fn()

vi.mock('sonner', () => ({
  toast: { error: (...args: any[]) => mockToastError(...args) },
}))

vi.mock('@TTH/services/fileService', () => ({
  fileService: { listDir: (...args: any[]) => mockListDir(...args) },
}))

vi.mock('@TTH/actions/editor/getFileCtx', () => ({
  getFileCtx: (...args: any[]) => mockGetFileCtx(...args),
}))

let fileTreeData = new Map<string, TFileEntry[]>()
let fileTreeRoot: string | null = null
let loadingFolders = new Set<string>()
let expandedFolders = new Set<string>()

vi.mock('@TTH/state/accessors', () => ({
  getFileTreeData: () => fileTreeData,
  setFileTreeData: (next: Map<string, TFileEntry[]>) => {
    fileTreeData = next
  },
  setFileTreeRoot: (next: string) => {
    fileTreeRoot = next
  },
  getFileTreeRoot: () => fileTreeRoot,
  getLoadingFolders: () => loadingFolders,
  setLoadingFolders: (next: Set<string>) => {
    loadingFolders = next
  },
  getExpandedFolders: () => expandedFolders,
  setExpandedFolders: (next: Set<string>) => {
    expandedFolders = next
  },
}))

import { loadDirectory } from './loadDirectory'

const fileCtx: TFileCtx = {
  orgId: `og_1`,
  projectId: `pj_1`,
  sandboxId: `sb_1`,
  instanceId: `in_1`,
}

const entry = (
  name: string,
  type: `file` | `folder`,
  path = `/src/${name}`
): TFileEntry => ({
  name,
  path,
  type,
})

describe(`loadDirectory`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fileTreeData = new Map()
    fileTreeRoot = null
    loadingFolders = new Set()
    expandedFolders = new Set()
    mockGetFileCtx.mockReturnValue(fileCtx)
    mockListDir.mockResolvedValue([])
  })

  it(`errors and returns before touching fileService or the loading set when there is no active sandbox session`, async () => {
    mockGetFileCtx.mockReturnValue(null)

    await loadDirectory(`/src`)

    expect(mockToastError).toHaveBeenCalledWith(
      `Cannot load files`,
      expect.objectContaining({ description: `No active sandbox session` })
    )
    expect(mockListDir).not.toHaveBeenCalled()
    expect(loadingFolders.has(`/src`)).toBe(false)
  })

  it(`passes an override sessionId through to getFileCtx`, async () => {
    await loadDirectory(`/src`, `sess_override`)

    expect(mockGetFileCtx).toHaveBeenCalledWith(`sess_override`)
  })

  it(`no-ops without calling fileService when the directory is already loading`, async () => {
    loadingFolders = new Set([`/src`])

    await loadDirectory(`/src`)

    expect(mockListDir).not.toHaveBeenCalled()
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it(`adds the dirPath to a NEW loading Set (not mutating the original) while the load is in flight`, async () => {
    const originalLoading = loadingFolders
    let resolveListDir: (v: TFileEntry[]) => void = () => {}
    mockListDir.mockImplementationOnce(
      () =>
        new Promise<TFileEntry[]>((resolve) => {
          resolveListDir = resolve
        })
    )

    const promise = loadDirectory(`/src`)

    expect(loadingFolders.has(`/src`)).toBe(true)
    expect(loadingFolders).not.toBe(originalLoading)
    expect(originalLoading.has(`/src`)).toBe(false)

    resolveListDir([])
    await promise
  })

  it(`calls fileService.listDir with the ctx and dirPath`, async () => {
    await loadDirectory(`/src`)

    expect(mockListDir).toHaveBeenCalledWith(fileCtx, `/src`)
  })

  it(`sorts folders before files regardless of input order`, async () => {
    mockListDir.mockResolvedValueOnce([
      entry(`b.ts`, `file`),
      entry(`sub`, `folder`),
      entry(`a.ts`, `file`),
    ])

    await loadDirectory(`/src`)

    const sorted = fileTreeData.get(`/src`)
    expect(sorted?.map((e) => e.name)).toEqual([`sub`, `a.ts`, `b.ts`])
  })

  it(`sorts entries of the same type alphabetically by name (localeCompare)`, async () => {
    mockListDir.mockResolvedValueOnce([
      entry(`zeta`, `folder`),
      entry(`alpha`, `folder`),
      entry(`mid`, `folder`),
    ])

    await loadDirectory(`/src`)

    const sorted = fileTreeData.get(`/src`)
    expect(sorted?.map((e) => e.name)).toEqual([`alpha`, `mid`, `zeta`])
  })

  it(`commits the sorted entries to a NEW Map (not mutating the original), preserving other directories`, async () => {
    const otherEntries = [entry(`old.ts`, `file`, `/other/old.ts`)]
    fileTreeData = new Map([[`/other`, otherEntries]])
    const originalData = fileTreeData
    mockListDir.mockResolvedValueOnce([entry(`new.ts`, `file`)])

    await loadDirectory(`/src`)

    expect(fileTreeData).not.toBe(originalData)
    expect(fileTreeData.get(`/other`)).toBe(otherEntries)
    expect(fileTreeData.get(`/src`)?.map((e) => e.name)).toEqual([`new.ts`])
  })

  it(`sets the file tree root and expands it when no root is set yet`, async () => {
    await loadDirectory(`/src`)

    expect(fileTreeRoot).toBe(`/src`)
    expect(expandedFolders.has(`/src`)).toBe(true)
  })

  it(`preserves other expanded folders in a NEW Set when setting the root`, async () => {
    expandedFolders = new Set([`/already/open`])
    const originalExpanded = expandedFolders

    await loadDirectory(`/src`)

    expect(expandedFolders).not.toBe(originalExpanded)
    expect(expandedFolders.has(`/already/open`)).toBe(true)
    expect(expandedFolders.has(`/src`)).toBe(true)
  })

  it(`does NOT set the root or expand it when a root is already set`, async () => {
    fileTreeRoot = `/existing-root`
    expandedFolders = new Set([`/existing-root`])

    await loadDirectory(`/nested`)

    expect(fileTreeRoot).toBe(`/existing-root`)
    expect(expandedFolders.has(`/nested`)).toBe(false)
  })

  it(`warns and errors with the message when listDir throws a real Error, without touching tree data or root`, async () => {
    fileTreeData = new Map([[`/other`, []]])
    const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
    mockListDir.mockRejectedValueOnce(new Error(`disk full`))

    await loadDirectory(`/src`)

    expect(warnSpy).toHaveBeenCalledWith(
      `[FileTree] Failed to load directory /src:`,
      expect.any(Error)
    )
    expect(mockToastError).toHaveBeenCalledWith(
      `Failed to load directory`,
      expect.objectContaining({ description: `disk full` })
    )
    expect(fileTreeData.has(`/src`)).toBe(false)
    expect(fileTreeRoot).toBeNull()
    warnSpy.mockRestore()
  })

  it(`errors with the fallback message when listDir throws a non-Error`, async () => {
    const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
    mockListDir.mockRejectedValueOnce(`nope`)

    await loadDirectory(`/src`)

    expect(mockToastError).toHaveBeenCalledWith(
      `Failed to load directory`,
      expect.objectContaining({ description: `Unknown error` })
    )
    warnSpy.mockRestore()
  })

  it(`always clears the dirPath from loadingFolders via a NEW Set on success, preserving other entries`, async () => {
    loadingFolders = new Set([`/other-loading`])

    await loadDirectory(`/src`)

    expect(loadingFolders.has(`/src`)).toBe(false)
    expect(loadingFolders.has(`/other-loading`)).toBe(true)
  })

  it(`always clears the dirPath from loadingFolders even when listDir throws`, async () => {
    const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
    loadingFolders = new Set([`/other-loading`])
    mockListDir.mockRejectedValueOnce(new Error(`boom`))

    await loadDirectory(`/src`)

    expect(loadingFolders.has(`/src`)).toBe(false)
    expect(loadingFolders.has(`/other-loading`)).toBe(true)
    warnSpy.mockRestore()
  })
})
