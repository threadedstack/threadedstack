import type { TFileEntry } from '@TTH/types'

import { toast } from 'sonner'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDeleteFolder = vi.fn()
const mockDeleteFile = vi.fn()
const mockGetFileCtx = vi.fn()
const mockLoadDirectory = vi.fn()
const mockCancelFileTreeAction = vi.fn()
const mockCloseRelatedTabs = vi.fn()
const mockCleanFolderState = vi.fn()

const callLog: string[] = []

vi.mock(`sonner`, () => ({
  toast: { error: vi.fn(), warning: vi.fn() },
}))

vi.mock(`@TTH/services/fileService`, () => ({
  fileService: {
    deleteFolder: (...args: any[]) => mockDeleteFolder(...args),
    deleteFile: (...args: any[]) => mockDeleteFile(...args),
  },
}))

vi.mock(`@TTH/actions/editor/getFileCtx`, () => ({
  getFileCtx: () => mockGetFileCtx(),
}))

vi.mock(`@TTH/actions/editor/loadDirectory`, () => ({
  loadDirectory: (...args: any[]) => mockLoadDirectory(...args),
}))

vi.mock(`@TTH/actions/editor/fileTreeAction`, () => ({
  cancelFileTreeAction: () => {
    callLog.push(`cancelFileTreeAction`)
    mockCancelFileTreeAction()
  },
}))

vi.mock(`@TTH/actions/editor/editorCleanup`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('./editorCleanup')>()
  return {
    ...actual,
    closeRelatedTabs: (...args: any[]) => {
      callLog.push(`closeRelatedTabs`)
      mockCloseRelatedTabs(...args)
    },
    cleanFolderState: (...args: any[]) => {
      callLog.push(`cleanFolderState`)
      mockCleanFolderState(...args)
    },
  }
})

import { deleteEntry } from './deleteEntry'

const folderEntry: TFileEntry = { name: `sub`, path: `/root/sub`, type: `folder` }
const fileEntry: TFileEntry = { name: `a.txt`, path: `/root/a.txt`, type: `file` }

describe(`deleteEntry`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callLog.length = 0
    mockGetFileCtx.mockReturnValue({
      orgId: `org-1`,
      projectId: `project-1`,
      sandboxId: `sandbox-1`,
      instanceId: `instance-1`,
    })
    mockDeleteFolder.mockResolvedValue(undefined)
    mockDeleteFile.mockResolvedValue(undefined)
    mockLoadDirectory.mockResolvedValue(undefined)
  })

  it(`PENDING GUARD: a second concurrent call returns immediately without touching fileService or toast`, async () => {
    let resolveDelete: () => void = () => {}
    mockDeleteFile.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve
      })
    )

    const first = deleteEntry(fileEntry)
    const second = deleteEntry(fileEntry)

    expect(mockDeleteFile).toHaveBeenCalledTimes(1)
    expect(mockGetFileCtx).toHaveBeenCalledTimes(1)

    resolveDelete()
    await Promise.all([first, second])
  })

  it(`no active sandbox session: toasts an error and returns before fileService or pending are ever touched`, async () => {
    mockGetFileCtx.mockReturnValue(undefined)

    await deleteEntry(fileEntry)

    expect(toast.error).toHaveBeenCalledWith(`Cannot delete`, {
      description: `No active sandbox session`,
    })
    expect(mockDeleteFile).not.toHaveBeenCalled()
    expect(mockDeleteFolder).not.toHaveBeenCalled()
  })

  it(`entry.type === 'folder' calls fileService.deleteFolder, not deleteFile`, async () => {
    await deleteEntry(folderEntry)

    expect(mockDeleteFolder).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: `org-1` }),
      `/root/sub`
    )
    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it(`entry.type === 'file' calls fileService.deleteFile, not deleteFolder`, async () => {
    await deleteEntry(fileEntry)

    expect(mockDeleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: `org-1` }),
      `/root/a.txt`
    )
    expect(mockDeleteFolder).not.toHaveBeenCalled()
  })

  it(`on deleteFolder failure with a real Error, toasts the error message and skips all post-delete steps`, async () => {
    mockDeleteFolder.mockRejectedValue(new Error(`permission denied`))

    await deleteEntry(folderEntry)

    expect(toast.error).toHaveBeenCalledWith(`Failed to delete folder`, {
      description: `permission denied`,
    })
    expect(mockCleanFolderState).not.toHaveBeenCalled()
    expect(mockCloseRelatedTabs).not.toHaveBeenCalled()
    expect(mockCancelFileTreeAction).not.toHaveBeenCalled()
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })

  it(`on deleteFile failure with a non-Error throw, toasts the generic fallback message`, async () => {
    mockDeleteFile.mockRejectedValue(`plain string rejection`)

    await deleteEntry(fileEntry)

    expect(toast.error).toHaveBeenCalledWith(`Failed to delete file`, {
      description: `An unexpected error occurred`,
    })
  })

  it(`resets pending after a failure, so a subsequent call is not blocked`, async () => {
    mockDeleteFile.mockRejectedValueOnce(new Error(`boom`))
    await deleteEntry(fileEntry)

    mockDeleteFile.mockResolvedValueOnce(undefined)
    await deleteEntry(fileEntry)

    expect(mockDeleteFile).toHaveBeenCalledTimes(2)
  })

  it(`SUCCESS + isFolder: calls cleanFolderState; SUCCESS + file: does not`, async () => {
    await deleteEntry(folderEntry)
    expect(mockCleanFolderState).toHaveBeenCalledWith(`/root/sub`)

    vi.clearAllMocks()
    mockDeleteFile.mockResolvedValue(undefined)

    await deleteEntry(fileEntry)
    expect(mockCleanFolderState).not.toHaveBeenCalled()
  })

  it(`on success, calls closeRelatedTabs with the correct isFolder flag and cancelFileTreeAction`, async () => {
    await deleteEntry(fileEntry)

    expect(mockCloseRelatedTabs).toHaveBeenCalledWith(`/root/a.txt`, false)
    expect(mockCancelFileTreeAction).toHaveBeenCalledTimes(1)
  })

  it(`CALL ORDER: cleanFolderState -> closeRelatedTabs -> cancelFileTreeAction (folder path)`, async () => {
    await deleteEntry(folderEntry)

    expect(callLog).toEqual([
      `cleanFolderState`,
      `closeRelatedTabs`,
      `cancelFileTreeAction`,
    ])
  })

  it(`calls loadDirectory with the REAL parentDir of entry.path`, async () => {
    await deleteEntry({ name: `c.txt`, path: `/a/b/c.txt`, type: `file` })

    expect(mockLoadDirectory).toHaveBeenCalledWith(`/a/b`)
  })

  it(`loadDirectory resolving produces no warning toast`, async () => {
    await deleteEntry(fileEntry)

    expect(toast.warning).not.toHaveBeenCalled()
  })

  it(`loadDirectory rejecting with a real Error toasts a warning with the error message (file)`, async () => {
    mockLoadDirectory.mockRejectedValue(new Error(`tree refresh failed`))

    await deleteEntry(fileEntry)

    expect(toast.warning).toHaveBeenCalledWith(
      `File deleted, but tree failed to refresh`,
      {
        description: `tree refresh failed`,
      }
    )
  })

  it(`loadDirectory rejecting with a non-Error toasts the fallback message (folder)`, async () => {
    mockLoadDirectory.mockRejectedValue(`plain rejection`)

    await deleteEntry(folderEntry)

    expect(toast.warning).toHaveBeenCalledWith(
      `Folder deleted, but tree failed to refresh`,
      { description: `Click the refresh button to update` }
    )
  })
})
