import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EFileOp, EShellMsg } from '@tdsk/domain'
import type { TFileTreeChangedMessage } from '@tdsk/domain'

const mockLoadDirectory = vi.fn()
const mockCloseRelatedTabs = vi.fn()
const mockCleanFolderState = vi.fn()
const mockGetFileTreeRoot = vi.fn()
const mockGetFileTreeData = vi.fn()
const mockGetFileContentCache = vi.fn()
const mockSetFileContentCache = vi.fn()
const mockGetActiveSession = vi.fn()
const mockGetOpenSessions = vi.fn()

vi.mock(`@TTH/actions/editor/loadDirectory`, () => ({
  loadDirectory: (...args: any[]) => mockLoadDirectory(...args),
}))

vi.mock(`@TTH/actions/editor/editorCleanup`, () => ({
  parentDir: (path: string) => {
    const idx = path.lastIndexOf(`/`)
    return idx > 0 ? path.slice(0, idx) : `/`
  },
  closeRelatedTabs: (...args: any[]) => mockCloseRelatedTabs(...args),
  cleanFolderState: (...args: any[]) => mockCleanFolderState(...args),
}))

vi.mock(`@TTH/state/accessors`, () => ({
  getFileTreeRoot: () => mockGetFileTreeRoot(),
  getFileTreeData: () => mockGetFileTreeData(),
  getFileContentCache: () => mockGetFileContentCache(),
  setFileContentCache: (...args: any[]) => mockSetFileContentCache(...args),
  getActiveSession: () => mockGetActiveSession(),
  getOpenSessions: () => mockGetOpenSessions(),
}))

import { handleFileTreeChanged, clearFileTreeSyncTimers } from './handleFileTreeChanged'

const baseSession = { sandboxId: `sandbox-1`, instanceId: `instance-1` }

const buildMsg = (
  overrides: Partial<TFileTreeChangedMessage> = {}
): TFileTreeChangedMessage => ({
  path: `/root/dir/file.ts`,
  sandboxId: `sandbox-1`,
  instanceId: `instance-1`,
  changeType: EFileOp.write,
  entryType: `file`,
  type: EShellMsg.FileTreeChanged,
  ...overrides,
})

describe(`handleFileTreeChanged`, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    clearFileTreeSyncTimers()
    mockGetActiveSession.mockReturnValue(`session-1`)
    mockGetOpenSessions.mockReturnValue(new Map([[`session-1`, baseSession]]))
    mockGetFileTreeRoot.mockReturnValue(`/root`)
    mockGetFileTreeData.mockReturnValue(new Map())
    mockGetFileContentCache.mockReturnValue(new Map())
    mockLoadDirectory.mockResolvedValue(undefined)
  })

  afterEach(() => {
    clearFileTreeSyncTimers()
    vi.useRealTimers()
  })

  it(`no-ops when there is no active session`, () => {
    mockGetActiveSession.mockReturnValue(null)

    handleFileTreeChanged(buildMsg())

    expect(mockCloseRelatedTabs).not.toHaveBeenCalled()
    expect(mockCleanFolderState).not.toHaveBeenCalled()
    expect(mockSetFileContentCache).not.toHaveBeenCalled()
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })

  it(`no-ops when the active session is not in getOpenSessions`, () => {
    mockGetOpenSessions.mockReturnValue(new Map())

    handleFileTreeChanged(buildMsg())

    expect(mockCloseRelatedTabs).not.toHaveBeenCalled()
    expect(mockSetFileContentCache).not.toHaveBeenCalled()
  })

  it(`no-ops on a foreign sandboxId (stale/foreign sandbox message)`, () => {
    handleFileTreeChanged(buildMsg({ sandboxId: `sandbox-other` }))

    expect(mockCloseRelatedTabs).not.toHaveBeenCalled()
    expect(mockSetFileContentCache).not.toHaveBeenCalled()
  })

  it(`no-ops on a mismatched instanceId (stale instance after sandbox restart)`, () => {
    handleFileTreeChanged(buildMsg({ instanceId: `instance-other` }))

    expect(mockCloseRelatedTabs).not.toHaveBeenCalled()
    expect(mockSetFileContentCache).not.toHaveBeenCalled()
  })

  it(`no-ops when the file tree has not yet loaded (getFileTreeRoot falsy)`, () => {
    mockGetFileTreeRoot.mockReturnValue(null)

    handleFileTreeChanged(buildMsg({ changeType: EFileOp.delete }))

    expect(mockCloseRelatedTabs).not.toHaveBeenCalled()
    expect(mockCleanFolderState).not.toHaveBeenCalled()
  })

  it(`delete + folder: calls cleanFolderState then closeRelatedTabs(path, true)`, () => {
    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.delete, entryType: `folder`, path: `/root/dir` })
    )

    expect(mockCleanFolderState).toHaveBeenCalledWith(`/root/dir`)
    expect(mockCloseRelatedTabs).toHaveBeenCalledWith(`/root/dir`, true)
  })

  it(`delete + file: does NOT call cleanFolderState, calls closeRelatedTabs(path, false)`, () => {
    handleFileTreeChanged(
      buildMsg({
        changeType: EFileOp.delete,
        entryType: `file`,
        path: `/root/dir/file.ts`,
      })
    )

    expect(mockCleanFolderState).not.toHaveBeenCalled()
    expect(mockCloseRelatedTabs).toHaveBeenCalledWith(`/root/dir/file.ts`, false)
  })

  it(`delete: unlike write, falls through to the debounced-refresh scheduling (no early return after cleanup)`, () => {
    mockGetFileTreeData.mockReturnValue(new Map([[`/root/dir`, {}]]))

    handleFileTreeChanged(
      buildMsg({
        changeType: EFileOp.delete,
        entryType: `file`,
        path: `/root/dir/file.ts`,
      })
    )

    expect(mockCloseRelatedTabs).toHaveBeenCalledWith(`/root/dir/file.ts`, false)
    expect(mockLoadDirectory).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(mockLoadDirectory).toHaveBeenCalledWith(`/root/dir`)
    expect(mockLoadDirectory).toHaveBeenCalledTimes(1)
  })

  it(`delete: schedules nothing when the affected dir is NOT tracked in the file tree`, () => {
    mockGetFileTreeData.mockReturnValue(new Map())

    handleFileTreeChanged(
      buildMsg({
        changeType: EFileOp.delete,
        entryType: `file`,
        path: `/root/dir/file.ts`,
      })
    )

    vi.advanceTimersByTime(1000)
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })

  it(`write with no cache entry: setFileContentCache is not called and the function returns without scheduling a refresh`, () => {
    handleFileTreeChanged(buildMsg({ changeType: EFileOp.write }))

    expect(mockSetFileContentCache).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })

  it(`write with a 'loaded' cache entry: commits a NEW Map with externallyModified merged in`, () => {
    const existingCache = new Map([
      [`/root/dir/file.ts`, { status: `loaded`, content: `hi` }],
    ])
    mockGetFileContentCache.mockReturnValue(existingCache)

    handleFileTreeChanged(buildMsg({ changeType: EFileOp.write }))

    expect(mockSetFileContentCache).toHaveBeenCalledTimes(1)
    const committed = mockSetFileContentCache.mock.calls[0]![0] as Map<string, any>
    expect(committed).not.toBe(existingCache)
    expect(committed.get(`/root/dir/file.ts`)).toEqual({
      status: `loaded`,
      content: `hi`,
      externallyModified: true,
    })
  })

  it(`write with a 'dirty' cache entry: commits the same externallyModified merge`, () => {
    const existingCache = new Map([
      [`/root/dir/file.ts`, { status: `dirty`, content: `edited` }],
    ])
    mockGetFileContentCache.mockReturnValue(existingCache)

    handleFileTreeChanged(buildMsg({ changeType: EFileOp.write }))

    expect(mockSetFileContentCache).toHaveBeenCalledTimes(1)
    const committed = mockSetFileContentCache.mock.calls[0]![0] as Map<string, any>
    expect(committed.get(`/root/dir/file.ts`)).toEqual({
      status: `dirty`,
      content: `edited`,
      externallyModified: true,
    })
  })

  it(`write with a 'loading' or 'error' cache entry: setFileContentCache is not called`, () => {
    mockGetFileContentCache.mockReturnValue(
      new Map([[`/root/dir/file.ts`, { status: `loading` }]])
    )
    handleFileTreeChanged(buildMsg({ changeType: EFileOp.write }))
    expect(mockSetFileContentCache).not.toHaveBeenCalled()

    mockSetFileContentCache.mockClear()
    mockGetFileContentCache.mockReturnValue(
      new Map([[`/root/dir/file.ts`, { status: `error`, error: `boom` }]])
    )
    handleFileTreeChanged(buildMsg({ changeType: EFileOp.write }))
    expect(mockSetFileContentCache).not.toHaveBeenCalled()
  })

  it(`fallthrough (create): schedules a 300ms debounced refresh when the affected dir is tracked in the file tree`, () => {
    mockGetFileTreeData.mockReturnValue(new Map([[`/root/dir`, {}]]))

    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.create, path: `/root/dir/new.ts` })
    )

    expect(mockLoadDirectory).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(mockLoadDirectory).toHaveBeenCalledWith(`/root/dir`)
    expect(mockLoadDirectory).toHaveBeenCalledTimes(1)
  })

  it(`fallthrough (create): schedules nothing when the affected dir is NOT tracked in the file tree`, () => {
    mockGetFileTreeData.mockReturnValue(new Map())

    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.create, path: `/root/dir/new.ts` })
    )

    vi.advanceTimersByTime(1000)
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })

  it(`DEBOUNCE COALESCING: two changes under the same tracked parent dir schedule only one timer and refresh it once`, () => {
    mockGetFileTreeData.mockReturnValue(new Map([[`/root/dir`, {}]]))

    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.create, path: `/root/dir/a.ts` })
    )
    expect(vi.getTimerCount()).toBe(1)
    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.create, path: `/root/dir/b.ts` })
    )
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(300)

    expect(mockLoadDirectory).toHaveBeenCalledTimes(1)
    expect(mockLoadDirectory).toHaveBeenCalledWith(`/root/dir`)
  })

  it(`two changes under DIFFERENT tracked parent dirs each get their own refresh after the debounce window`, () => {
    mockGetFileTreeData.mockReturnValue(
      new Map([
        [`/root/dirA`, {}],
        [`/root/dirB`, {}],
      ])
    )

    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.create, path: `/root/dirA/a.ts` })
    )
    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.create, path: `/root/dirB/b.ts` })
    )

    vi.advanceTimersByTime(300)

    expect(mockLoadDirectory).toHaveBeenCalledTimes(2)
    expect(mockLoadDirectory).toHaveBeenCalledWith(`/root/dirA`)
    expect(mockLoadDirectory).toHaveBeenCalledWith(`/root/dirB`)
  })

  it(`after a debounce flush, pendingDirs/timer reset so a subsequent qualifying call schedules a fresh timer`, () => {
    mockGetFileTreeData.mockReturnValue(new Map([[`/root/dir`, {}]]))

    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.create, path: `/root/dir/a.ts` })
    )
    vi.advanceTimersByTime(300)
    expect(mockLoadDirectory).toHaveBeenCalledTimes(1)

    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.create, path: `/root/dir/b.ts` })
    )
    vi.advanceTimersByTime(300)
    expect(mockLoadDirectory).toHaveBeenCalledTimes(2)
  })

  it(`clearFileTreeSyncTimers cancels a pending debounce and resets pendingDirs`, () => {
    mockGetFileTreeData.mockReturnValue(new Map([[`/root/dir`, {}]]))

    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.create, path: `/root/dir/a.ts` })
    )
    expect(vi.getTimerCount()).toBe(1)

    clearFileTreeSyncTimers()
    expect(vi.getTimerCount()).toBe(0)

    vi.advanceTimersByTime(1000)
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })

  it(`a rejected loadDirectory for one flushed dir is caught internally and does not block other dirs in the same flush`, async () => {
    const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => undefined)
    mockGetFileTreeData.mockReturnValue(
      new Map([
        [`/root/good`, {}],
        [`/root/bad`, {}],
      ])
    )
    mockLoadDirectory.mockImplementation((dir: string) =>
      dir === `/root/bad` ? Promise.reject(new Error(`boom`)) : Promise.resolve()
    )

    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.create, path: `/root/good/a.ts` })
    )
    handleFileTreeChanged(
      buildMsg({ changeType: EFileOp.create, path: `/root/bad/b.ts` })
    )

    await vi.advanceTimersByTimeAsync(300)

    expect(mockLoadDirectory).toHaveBeenCalledWith(`/root/good`)
    expect(mockLoadDirectory).toHaveBeenCalledWith(`/root/bad`)
    expect(warnSpy).toHaveBeenCalledWith(
      `[FileTreeSync] Failed to refresh directory:`,
      `/root/bad`,
      expect.any(Error)
    )

    warnSpy.mockRestore()
  })
})
