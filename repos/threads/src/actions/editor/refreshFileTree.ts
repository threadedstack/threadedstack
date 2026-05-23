import { toast } from 'sonner'
import { loadDirectory } from '@TTH/actions/editor/loadDirectory'
import {
  getFileTreeRoot,
  getFileTreeData,
  setFileTreeData,
  getExpandedFolders,
} from '@TTH/state/accessors'

export const refreshFileTree = async () => {
  const root = getFileTreeRoot()
  if (!root) return

  const previousData = getFileTreeData()
  const expanded = getExpandedFolders()
  setFileTreeData(new Map())

  try {
    await loadDirectory(root)

    const promises: Promise<void>[] = []
    for (const dir of expanded) {
      if (dir !== root) promises.push(loadDirectory(dir))
    }

    const results = await Promise.allSettled(promises)
    const failures = results.filter((r) => r.status === `rejected`)
    if (failures.length > 0) {
      console.warn(`[FileTree] ${failures.length} directories failed to refresh`)
      toast.warning(`Some folders failed to refresh`, {
        description: `${failures.length} ${failures.length === 1 ? `directory` : `directories`} could not be loaded`,
      })
    }
  } catch (err) {
    setFileTreeData(previousData)
    console.warn(`[FileTree] Refresh failed:`, err)
    toast.error(`Failed to refresh file tree`, {
      description: err instanceof Error ? err.message : `Unknown error`,
    })
  }
}
