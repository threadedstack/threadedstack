import { toast } from 'sonner'
import { fileService } from '@TTH/services/fileService'
import { getFileCtx } from '@TTH/actions/editor/getFileCtx'
import {
  getFileTreeData,
  setFileTreeData,
  setFileTreeRoot,
  getFileTreeRoot,
  getLoadingFolders,
  setLoadingFolders,
  getExpandedFolders,
  setExpandedFolders,
} from '@TTH/state/accessors'

export const loadDirectory = async (dirPath: string, sessionId?: string) => {
  const ctx = getFileCtx(sessionId)
  if (!ctx) {
    toast.error(`Cannot load files`, { description: `No active sandbox session` })
    return
  }

  const loading = new Set(getLoadingFolders())
  if (loading.has(dirPath)) return
  loading.add(dirPath)
  setLoadingFolders(loading)

  try {
    const entries = await fileService.listDir(ctx, dirPath)

    const sorted = entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === `folder` ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    const data = new Map(getFileTreeData())
    data.set(dirPath, sorted)
    setFileTreeData(data)

    const isRoot = !getFileTreeRoot()
    if (isRoot) {
      setFileTreeRoot(dirPath)
      const expanded = new Set(getExpandedFolders())
      expanded.add(dirPath)
      setExpandedFolders(expanded)
    }
  } catch (err) {
    console.warn(`[FileTree] Failed to load directory ${dirPath}:`, err)
    toast.error(`Failed to load directory`, {
      description: err instanceof Error ? err.message : `Unknown error`,
    })
  } finally {
    const updated = new Set(getLoadingFolders())
    updated.delete(dirPath)
    setLoadingFolders(updated)
  }
}
