import {
  getExpandedFolders,
  setExpandedFolders,
  getFileTreeData,
} from '@TTH/state/accessors'
import { loadDirectory } from '@TTH/actions/editor/loadDirectory'

export const toggleFolder = (dirPath: string) => {
  const expanded = new Set(getExpandedFolders())

  if (expanded.has(dirPath)) {
    expanded.delete(dirPath)
    setExpandedFolders(expanded)
    return
  }

  expanded.add(dirPath)
  setExpandedFolders(expanded)

  if (!getFileTreeData().has(dirPath)) {
    loadDirectory(dirPath).catch((err) => {
      console.warn(`[FileTree] Failed to load ${dirPath}:`, err)
    })
  }
}
