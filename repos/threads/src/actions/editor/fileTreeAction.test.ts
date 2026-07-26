import type { TFileTreeAction } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockToggleFolder = vi.fn()
const mockSetFileTreeAction = vi.fn()

vi.mock('@TTH/actions/editor/toggleFolder', () => ({
  toggleFolder: (...args: any[]) => mockToggleFolder(...args),
}))

let expandedFolders = new Set<string>()

vi.mock('@TTH/state/accessors', () => ({
  getExpandedFolders: () => expandedFolders,
  setFileTreeAction: (...args: any[]) => mockSetFileTreeAction(...args),
}))

import { startFileTreeAction, cancelFileTreeAction } from './fileTreeAction'

describe(`startFileTreeAction`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    expandedFolders = new Set()
  })

  it(`auto-expands the parent folder for create-file when it is not already expanded`, () => {
    const action: TFileTreeAction = { type: `create-file`, parentPath: `/src` }

    startFileTreeAction(action)

    expect(mockToggleFolder).toHaveBeenCalledWith(`/src`)
    expect(mockSetFileTreeAction).toHaveBeenCalledWith(action)
  })

  it(`auto-expands the parent folder for create-folder when it is not already expanded`, () => {
    const action: TFileTreeAction = { type: `create-folder`, parentPath: `/src` }

    startFileTreeAction(action)

    expect(mockToggleFolder).toHaveBeenCalledWith(`/src`)
    expect(mockSetFileTreeAction).toHaveBeenCalledWith(action)
  })

  it(`does not toggle when the parent folder is already expanded`, () => {
    expandedFolders = new Set([`/src`])
    const action: TFileTreeAction = { type: `create-file`, parentPath: `/src` }

    startFileTreeAction(action)

    expect(mockToggleFolder).not.toHaveBeenCalled()
    expect(mockSetFileTreeAction).toHaveBeenCalledWith(action)
  })

  it(`never toggles for confirm-delete regardless of expanded-folders state`, () => {
    const action: TFileTreeAction = {
      type: `confirm-delete`,
      entry: { name: `a.ts`, path: `/src/a.ts`, type: `file` },
    }

    startFileTreeAction(action)

    expect(mockToggleFolder).not.toHaveBeenCalled()
    expect(mockSetFileTreeAction).toHaveBeenCalledWith(action)
  })
})

describe(`cancelFileTreeAction`, () => {
  it(`sets the file tree action to null`, () => {
    cancelFileTreeAction()

    expect(mockSetFileTreeAction).toHaveBeenCalledWith(null)
  })
})
