import type { TFileEntry } from '@TTH/types'

import { toast } from 'sonner'
import { fileService } from '@TTH/services/fileService'
import { getFileCtx } from '@TTH/actions/editor/getFileCtx'
import { loadDirectory } from '@TTH/actions/editor/loadDirectory'
import { cancelFileTreeAction } from '@TTH/actions/editor/fileTreeAction'
import {
  parentDir,
  closeRelatedTabs,
  cleanFolderState,
} from '@TTH/actions/editor/editorCleanup'

let pending = false

export const deleteEntry = async (entry: TFileEntry) => {
  if (pending) return

  const ctx = getFileCtx()
  if (!ctx) {
    toast.error(`Cannot delete`, { description: `No active sandbox session` })
    return
  }

  const isFolder = entry.type === `folder`

  pending = true
  try {
    if (isFolder) {
      await fileService.deleteFolder(ctx, entry.path)
    } else {
      await fileService.deleteFile(ctx, entry.path)
    }
  } catch (err) {
    toast.error(`Failed to delete ${isFolder ? `folder` : `file`}`, {
      description: err instanceof Error ? err.message : `An unexpected error occurred`,
    })
    return
  } finally {
    pending = false
  }

  if (isFolder) cleanFolderState(entry.path)
  closeRelatedTabs(entry.path, isFolder)
  cancelFileTreeAction()

  try {
    await loadDirectory(parentDir(entry.path))
  } catch (err) {
    toast.warning(`${isFolder ? `Folder` : `File`} deleted, but tree failed to refresh`, {
      description:
        err instanceof Error ? err.message : `Click the refresh button to update`,
    })
  }
}
