import {
  getOpenEditorFiles,
  setOpenEditorFiles,
  getActiveEditorFile,
  setActiveEditorFile,
  getFileContentCache,
  setFileContentCache,
  getExpandedFolders,
  setExpandedFolders,
  getFileTreeData,
  setFileTreeData,
} from '@TTH/state/accessors'

export const parentDir = (path: string) => {
  const idx = path.lastIndexOf(`/`)
  return idx > 0 ? path.slice(0, idx) : `/`
}

export const closeRelatedTabs = (deletedPath: string, isFolder: boolean) => {
  const openFiles = getOpenEditorFiles()
  const activeFile = getActiveEditorFile()

  const affected = isFolder
    ? openFiles.filter((f) => f === deletedPath || f.startsWith(deletedPath + `/`))
    : openFiles.filter((f) => f === deletedPath)

  if (affected.length === 0) return

  const remaining = openFiles.filter((f) => !affected.includes(f))
  setOpenEditorFiles(remaining)

  if (activeFile && affected.includes(activeFile)) {
    setActiveEditorFile(remaining.length > 0 ? remaining[remaining.length - 1]! : null)
  }

  const cache = new Map(getFileContentCache())
  for (const path of affected) cache.delete(path)
  setFileContentCache(cache)
}

export const cleanFolderState = (deletedPath: string) => {
  const expanded = new Set(getExpandedFolders())
  const data = new Map(getFileTreeData())

  for (const key of [...expanded]) {
    if (key === deletedPath || key.startsWith(deletedPath + `/`)) expanded.delete(key)
  }
  for (const key of [...data.keys()]) {
    if (key === deletedPath || key.startsWith(deletedPath + `/`)) data.delete(key)
  }

  setExpandedFolders(expanded)
  setFileTreeData(data)
}
