import type { TFileCacheEntry, TFileCtx } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockWriteFile = vi.fn()
const mockToastError = vi.fn()
const mockGetFileCtx = vi.fn()

vi.mock('sonner', () => ({
  toast: { error: (...args: any[]) => mockToastError(...args) },
}))

vi.mock('@TTH/services/fileService', () => ({
  fileService: { writeFile: (...args: any[]) => mockWriteFile(...args) },
}))

vi.mock('@TTH/actions/editor/getFileCtx', () => ({
  getFileCtx: (...args: any[]) => mockGetFileCtx(...args),
}))

let cache = new Map<string, TFileCacheEntry>()
let savingFiles = new Set<string>()

vi.mock('@TTH/state/accessors', () => ({
  getFileContentCache: () => cache,
  setFileContentCache: (next: Map<string, TFileCacheEntry>) => {
    cache = next
  },
  getSavingFiles: () => savingFiles,
  setSavingFiles: (next: Set<string>) => {
    savingFiles = next
  },
}))

import { saveFileContent } from './saveFileContent'

const fileCtx: TFileCtx = {
  orgId: `og_1`,
  projectId: `pj_1`,
  sandboxId: `sb_1`,
  instanceId: `in_1`,
}

describe(`saveFileContent`, () => {
  const filePath = `/src/index.ts`

  beforeEach(() => {
    vi.clearAllMocks()
    cache = new Map()
    savingFiles = new Set()
    mockGetFileCtx.mockReturnValue(fileCtx)
  })

  it(`transitions dirty -> loaded with the saved content when there is no concurrent edit`, async () => {
    cache.set(filePath, { status: `dirty`, content: `v1` })
    mockWriteFile.mockResolvedValueOnce(undefined)

    await saveFileContent(filePath)

    expect(mockWriteFile).toHaveBeenCalledWith(fileCtx, filePath, `v1`)
    expect(cache.get(filePath)).toEqual({ status: `loaded`, content: `v1` })
    expect(savingFiles.has(filePath)).toBe(false)
  })

  it(`leaves the entry dirty with the newer content when an edit lands while the write is in flight`, async () => {
    cache.set(filePath, { status: `dirty`, content: `v1` })

    let resolveWrite: () => void = () => {}
    mockWriteFile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve
        })
    )

    const savePromise = saveFileContent(filePath)

    // Simulate markFileDirty landing a newer edit while the write above is in flight.
    cache.set(filePath, { status: `dirty`, content: `v2` })

    resolveWrite()
    await savePromise

    // v1 was persisted, but the cache must stay dirty with v2 -- v2 was never saved.
    expect(cache.get(filePath)).toEqual({ status: `dirty`, content: `v2` })
  })

  it(`leaves the entry dirty and surfaces the existing toast.error path on a failed write`, async () => {
    cache.set(filePath, { status: `dirty`, content: `v1` })
    mockWriteFile.mockRejectedValueOnce(new Error(`disk full`))

    await saveFileContent(filePath)

    expect(cache.get(filePath)).toEqual({ status: `dirty`, content: `v1` })
    expect(mockToastError).toHaveBeenCalledWith(
      `Failed to save file`,
      expect.objectContaining({ description: `disk full` })
    )
    expect(savingFiles.has(filePath)).toBe(false)
  })

  it(`no-ops when the entry is not dirty`, async () => {
    cache.set(filePath, { status: `loaded`, content: `v1` })

    await saveFileContent(filePath)

    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it(`no-ops when there is no cache entry for the file`, async () => {
    await saveFileContent(filePath)

    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it(`surfaces an error and does not write when there is no active sandbox session`, async () => {
    cache.set(filePath, { status: `dirty`, content: `v1` })
    mockGetFileCtx.mockReturnValue(null)

    await saveFileContent(filePath)

    expect(mockWriteFile).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith(
      `Cannot save file`,
      expect.objectContaining({ description: `No active sandbox session` })
    )
  })

  it(`tracks the file in savingFiles while the write is in flight`, async () => {
    cache.set(filePath, { status: `dirty`, content: `v1` })

    let resolveWrite: () => void = () => {}
    mockWriteFile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve
        })
    )

    const savePromise = saveFileContent(filePath)
    expect(savingFiles.has(filePath)).toBe(true)

    resolveWrite()
    await savePromise

    expect(savingFiles.has(filePath)).toBe(false)
  })
})
