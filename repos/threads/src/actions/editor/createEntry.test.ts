import type { TFileCtx } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockToastError = vi.fn()
const mockToastWarning = vi.fn()
const mockFileExists = vi.fn()
const mockCreateFile = vi.fn()
const mockCreateFolder = vi.fn()
const mockGetFileCtx = vi.fn()
const mockOpenEditorFile = vi.fn()
const mockLoadDirectory = vi.fn()
const mockToggleFolder = vi.fn()
const mockCancelFileTreeAction = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (...args: any[]) => mockToastError(...args),
    warning: (...args: any[]) => mockToastWarning(...args),
  },
}))

vi.mock('@TTH/services/fileService', () => ({
  fileService: {
    fileExists: (...args: any[]) => mockFileExists(...args),
    createFile: (...args: any[]) => mockCreateFile(...args),
    createFolder: (...args: any[]) => mockCreateFolder(...args),
  },
}))

vi.mock('@TTH/actions/editor/getFileCtx', () => ({
  getFileCtx: (...args: any[]) => mockGetFileCtx(...args),
}))

vi.mock('@TTH/actions/editor/openEditorFile', () => ({
  openEditorFile: (...args: any[]) => mockOpenEditorFile(...args),
}))

vi.mock('@TTH/actions/editor/loadDirectory', () => ({
  loadDirectory: (...args: any[]) => mockLoadDirectory(...args),
}))

vi.mock('@TTH/actions/editor/toggleFolder', () => ({
  toggleFolder: (...args: any[]) => mockToggleFolder(...args),
}))

vi.mock('@TTH/actions/editor/fileTreeAction', () => ({
  cancelFileTreeAction: (...args: any[]) => mockCancelFileTreeAction(...args),
}))

let expandedFolders = new Set<string>()

vi.mock('@TTH/state/accessors', () => ({
  getExpandedFolders: () => expandedFolders,
}))

import { createEntry } from './createEntry'

const fileCtx: TFileCtx = {
  orgId: `og_1`,
  projectId: `pj_1`,
  sandboxId: `sb_1`,
  instanceId: `in_1`,
}

describe(`createEntry`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    expandedFolders = new Set()
    mockGetFileCtx.mockReturnValue(fileCtx)
    mockFileExists.mockResolvedValue(false)
    mockCreateFile.mockResolvedValue(undefined)
    mockCreateFolder.mockResolvedValue(undefined)
    mockLoadDirectory.mockResolvedValue(undefined)
  })

  it(`no-ops on an empty or whitespace-only name without touching fileService or toasting`, async () => {
    await createEntry(`file`, `/src`, `   `)

    expect(mockFileExists).not.toHaveBeenCalled()
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it(`blocks a concurrent call while one is already pending, then allows the next call once it finishes`, async () => {
    let resolveExists: (v: boolean) => void = () => {}
    mockFileExists.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveExists = resolve
        })
    )

    const first = createEntry(`file`, `/src`, `a.ts`)
    const second = createEntry(`file`, `/src`, `b.ts`)

    resolveExists(false)
    await first
    await second

    // second call returned immediately while pending was true -- only one fileExists call.
    expect(mockFileExists).toHaveBeenCalledTimes(1)
    expect(mockFileExists).toHaveBeenCalledWith(fileCtx, `/src/a.ts`)

    // pending was reset in finally -- a subsequent call proceeds normally.
    await createEntry(`file`, `/src`, `c.ts`)
    expect(mockFileExists).toHaveBeenCalledTimes(2)
    expect(mockFileExists).toHaveBeenLastCalledWith(fileCtx, `/src/c.ts`)
  })

  describe(`validateName rejection paths`, () => {
    it(`rejects a name containing a slash or null character`, async () => {
      await createEntry(`file`, `/src`, `a/b`)

      expect(mockToastError).toHaveBeenCalledWith(
        `Invalid file name`,
        expect.objectContaining({
          description: `Name cannot contain / or null characters`,
        })
      )
      expect(mockGetFileCtx).not.toHaveBeenCalled()
    })

    it(`rejects a name containing a shell-unsafe character`, async () => {
      await createEntry(`file`, `/src`, `a;b`)

      expect(mockToastError).toHaveBeenCalledWith(
        `Invalid file name`,
        expect.objectContaining({ description: `Name contains unsafe characters` })
      )
      expect(mockGetFileCtx).not.toHaveBeenCalled()
    })

    it(`rejects a name that is exactly . or ..`, async () => {
      await createEntry(`folder`, `/src`, `..`)

      expect(mockToastError).toHaveBeenCalledWith(
        `Invalid folder name`,
        expect.objectContaining({ description: `Name cannot be . or ..` })
      )
      expect(mockGetFileCtx).not.toHaveBeenCalled()
    })

    it(`rejects a name containing .. as a substring`, async () => {
      await createEntry(`folder`, `/src`, `foo..bar`)

      expect(mockToastError).toHaveBeenCalledWith(
        `Invalid folder name`,
        expect.objectContaining({ description: `Name cannot contain ..` })
      )
      expect(mockGetFileCtx).not.toHaveBeenCalled()
    })

    it(`rejects a name starting with -`, async () => {
      await createEntry(`file`, `/src`, `-rf`)

      expect(mockToastError).toHaveBeenCalledWith(
        `Invalid file name`,
        expect.objectContaining({ description: `Name cannot start with -` })
      )
      expect(mockGetFileCtx).not.toHaveBeenCalled()
    })
  })

  it(`proceeds past validation for a valid name`, async () => {
    await createEntry(`file`, `/src`, `valid-name.ts`)

    expect(mockToastError).not.toHaveBeenCalledWith(
      expect.stringContaining(`Invalid`),
      expect.anything()
    )
    expect(mockGetFileCtx).toHaveBeenCalled()
  })

  it(`errors and returns before calling fileExists when there is no active sandbox session`, async () => {
    mockGetFileCtx.mockReturnValue(null)

    await createEntry(`file`, `/src`, `a.ts`)

    expect(mockToastError).toHaveBeenCalledWith(
      `Cannot create file`,
      expect.objectContaining({ description: `No active sandbox session` })
    )
    expect(mockFileExists).not.toHaveBeenCalled()
  })

  describe(`entryPath construction`, () => {
    it(`concatenates directly when parentPath ends with /`, async () => {
      await createEntry(`file`, `/src/`, `a.ts`)

      expect(mockFileExists).toHaveBeenCalledWith(fileCtx, `/src/a.ts`)
    })

    it(`inserts a / when parentPath does not end with /`, async () => {
      await createEntry(`file`, `/src`, `a.ts`)

      expect(mockFileExists).toHaveBeenCalledWith(fileCtx, `/src/a.ts`)
    })
  })

  it(`errors and never calls createFile/createFolder when the entry already exists`, async () => {
    mockFileExists.mockResolvedValue(true)

    await createEntry(`file`, `/src`, `a.ts`)

    expect(mockToastError).toHaveBeenCalledWith(
      `File already exists`,
      expect.objectContaining({ description: `/src/a.ts` })
    )
    expect(mockCreateFile).not.toHaveBeenCalled()
    expect(mockCreateFolder).not.toHaveBeenCalled()
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })

  it(`errors with the Folder wording when a folder already exists`, async () => {
    mockFileExists.mockResolvedValue(true)

    await createEntry(`folder`, `/src`, `sub`)

    expect(mockToastError).toHaveBeenCalledWith(
      `Folder already exists`,
      expect.objectContaining({ description: `/src/sub` })
    )
  })

  it(`calls createFile (not createFolder) for type file`, async () => {
    await createEntry(`file`, `/src`, `a.ts`)

    expect(mockCreateFile).toHaveBeenCalledWith(fileCtx, `/src/a.ts`)
    expect(mockCreateFolder).not.toHaveBeenCalled()
  })

  it(`calls createFolder (not createFile) for type folder`, async () => {
    await createEntry(`folder`, `/src`, `sub`)

    expect(mockCreateFolder).toHaveBeenCalledWith(fileCtx, `/src/sub`)
    expect(mockCreateFile).not.toHaveBeenCalled()
  })

  it(`calls cancelFileTreeAction after a successful create and resets pending so a subsequent call is not blocked`, async () => {
    await createEntry(`file`, `/src`, `a.ts`)

    expect(mockCancelFileTreeAction).toHaveBeenCalled()

    // pending reset via finally -- a subsequent call is not blocked.
    await createEntry(`file`, `/src`, `b.ts`)
    expect(mockFileExists).toHaveBeenLastCalledWith(fileCtx, `/src/b.ts`)
  })

  it(`errors with the message when fileExists throws a real Error, and never reaches loadDirectory or the post-create UI step`, async () => {
    mockFileExists.mockRejectedValue(new Error(`disk full`))

    await createEntry(`file`, `/src`, `a.ts`)

    expect(mockToastError).toHaveBeenCalledWith(
      `Failed to create file`,
      expect.objectContaining({ description: `disk full` })
    )
    expect(mockLoadDirectory).not.toHaveBeenCalled()
    expect(mockOpenEditorFile).not.toHaveBeenCalled()
    expect(mockToggleFolder).not.toHaveBeenCalled()
    expect(mockCancelFileTreeAction).not.toHaveBeenCalled()
  })

  it(`errors with the generic fallback message when createFile throws a non-Error, and pending is still reset`, async () => {
    mockCreateFile.mockRejectedValue(`nope`)

    await createEntry(`file`, `/src`, `a.ts`)

    expect(mockToastError).toHaveBeenCalledWith(
      `Failed to create file`,
      expect.objectContaining({ description: `An unexpected error occurred` })
    )

    await createEntry(`file`, `/src`, `b.ts`)
    expect(mockFileExists).toHaveBeenLastCalledWith(fileCtx, `/src/b.ts`)
  })

  it(`calls loadDirectory(parentPath) on the success path and does not warn when it resolves`, async () => {
    await createEntry(`file`, `/src`, `a.ts`)

    expect(mockLoadDirectory).toHaveBeenCalledWith(`/src`)
    expect(mockToastWarning).not.toHaveBeenCalled()
  })

  it(`warns with the error message when loadDirectory rejects, but still runs the post-create UI step`, async () => {
    mockLoadDirectory.mockRejectedValue(new Error(`tree broke`))

    await createEntry(`file`, `/src`, `a.ts`)

    expect(mockToastWarning).toHaveBeenCalledWith(
      `File created, but tree failed to refresh`,
      expect.objectContaining({ description: `tree broke` })
    )
    expect(mockOpenEditorFile).toHaveBeenCalledWith(`/src/a.ts`)
  })

  it(`warns with the fallback message when loadDirectory rejects a non-Error`, async () => {
    mockLoadDirectory.mockRejectedValue(`nope`)

    await createEntry(`folder`, `/src`, `sub`)

    expect(mockToastWarning).toHaveBeenCalledWith(
      `Folder created, but tree failed to refresh`,
      expect.objectContaining({ description: `Click the refresh button to update` })
    )
  })

  describe(`post-create UI step`, () => {
    it(`opens the file in the editor for type file (toggleFolder is not called)`, async () => {
      await createEntry(`file`, `/src`, `a.ts`)

      expect(mockOpenEditorFile).toHaveBeenCalledWith(`/src/a.ts`)
      expect(mockToggleFolder).not.toHaveBeenCalled()
    })

    it(`toggles the folder open for type folder when it is not already expanded`, async () => {
      await createEntry(`folder`, `/src`, `sub`)

      expect(mockToggleFolder).toHaveBeenCalledWith(`/src/sub`)
      expect(mockOpenEditorFile).not.toHaveBeenCalled()
    })

    it(`does not toggle the folder when it is already expanded`, async () => {
      expandedFolders = new Set([`/src/sub`])

      await createEntry(`folder`, `/src`, `sub`)

      expect(mockToggleFolder).not.toHaveBeenCalled()
    })

    it(`catches and warns (does not rethrow) when openEditorFile throws synchronously`, async () => {
      const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
      mockOpenEditorFile.mockImplementation(() => {
        throw new Error(`boom`)
      })

      await expect(createEntry(`file`, `/src`, `a.ts`)).resolves.toBeUndefined()

      expect(warnSpy).toHaveBeenCalledWith(
        `[Editor] Post-create UI update failed:`,
        expect.any(Error)
      )
      warnSpy.mockRestore()
    })

    it(`catches and warns (does not rethrow) when toggleFolder throws synchronously`, async () => {
      const warnSpy = vi.spyOn(console, `warn`).mockImplementation(() => {})
      mockToggleFolder.mockImplementation(() => {
        throw new Error(`boom`)
      })

      await expect(createEntry(`folder`, `/src`, `sub`)).resolves.toBeUndefined()

      expect(warnSpy).toHaveBeenCalledWith(
        `[Editor] Post-create UI update failed:`,
        expect.any(Error)
      )
      warnSpy.mockRestore()
    })
  })
})
