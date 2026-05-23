import type {
  TFileEntry,
  TFileCacheEntry,
  TCursorPosition,
  TFileTreeAction,
} from '@TTH/types'

import { atomWithReset } from 'jotai/utils'

export const defOpenEditorFiles: string[] = []
export const openEditorFilesState = atomWithReset<string[]>(defOpenEditorFiles)

export const defActiveEditorFile: string | null = null
export const activeEditorFileState = atomWithReset<string | null>(defActiveEditorFile)

export const defFileTreeData = new Map<string, TFileEntry[]>()
export const fileTreeDataState = atomWithReset<Map<string, TFileEntry[]>>(new Map())

export const defExpandedFolders = new Set<string>()
export const expandedFoldersState = atomWithReset<Set<string>>(new Set())

export const defLoadingFolders = new Set<string>()
export const loadingFoldersState = atomWithReset<Set<string>>(new Set())

export const defFileContentCache = new Map<string, TFileCacheEntry>()
export const fileContentCacheState = atomWithReset<Map<string, TFileCacheEntry>>(
  new Map()
)

export const defCursorPosition: TCursorPosition = { lineNumber: 1, column: 1 }
export const cursorPositionState = atomWithReset<TCursorPosition>(defCursorPosition)

export const defFileTreeRoot = ``
export const fileTreeRootState = atomWithReset<string>(defFileTreeRoot)

export const defSavingFiles = new Set<string>()
export const savingFilesState = atomWithReset<Set<string>>(new Set())

export const defFileTreeAction: TFileTreeAction | null = null
export const fileTreeActionState = atomWithReset<TFileTreeAction | null>(null)
