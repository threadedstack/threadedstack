import { toast } from 'sonner'
import { fileService } from '@TTH/services/fileService'
import { getFileCtx } from '@TTH/actions/editor/getFileCtx'
import { openEditorFile } from '@TTH/actions/editor/openEditorFile'
import { loadDirectory } from '@TTH/actions/editor/loadDirectory'
import { toggleFolder } from '@TTH/actions/editor/toggleFolder'
import { cancelFileTreeAction } from '@TTH/actions/editor/fileTreeAction'
import { getExpandedFolders } from '@TTH/state/accessors'

const InvalidNameChars = /[/\0]/
const ShellUnsafeChars = /[;|&$`\\<>(){}[\]!#~\n\r\t'"*?]/

const validateName = (name: string): string | null => {
  if (InvalidNameChars.test(name)) return `Name cannot contain / or null characters`
  if (ShellUnsafeChars.test(name)) return `Name contains unsafe characters`
  if (name === `.` || name === `..`) return `Name cannot be . or ..`
  if (name.includes(`..`)) return `Name cannot contain ..`
  if (name.startsWith(`-`)) return `Name cannot start with -`
  return null
}

let pending = false

export const createEntry = async (
  type: 'file' | 'folder',
  parentPath: string,
  name: string
) => {
  const trimmed = name.trim()
  if (!trimmed || pending) return

  const error = validateName(trimmed)
  if (error) {
    toast.error(`Invalid ${type} name`, { description: error })
    return
  }

  const ctx = getFileCtx()
  if (!ctx) {
    toast.error(`Cannot create ${type}`, { description: `No active sandbox session` })
    return
  }

  const entryPath = parentPath.endsWith(`/`)
    ? `${parentPath}${trimmed}`
    : `${parentPath}/${trimmed}`

  pending = true
  try {
    const exists = await fileService.fileExists(ctx, entryPath)
    if (exists) {
      toast.error(`${type === `file` ? `File` : `Folder`} already exists`, {
        description: entryPath,
      })
      return
    }

    if (type === `file`) {
      await fileService.createFile(ctx, entryPath)
    } else {
      await fileService.createFolder(ctx, entryPath)
    }

    cancelFileTreeAction()
  } catch (err) {
    toast.error(`Failed to create ${type}`, {
      description: err instanceof Error ? err.message : `An unexpected error occurred`,
    })
    return
  } finally {
    pending = false
  }

  try {
    await loadDirectory(parentPath)
  } catch (err) {
    toast.warning(
      `${type === `file` ? `File` : `Folder`} created, but tree failed to refresh`,
      {
        description:
          err instanceof Error ? err.message : `Click the refresh button to update`,
      }
    )
  }

  try {
    if (type === `file`) {
      openEditorFile(entryPath)
    } else if (!getExpandedFolders().has(entryPath)) {
      toggleFolder(entryPath)
    }
  } catch (err) {
    console.warn(`[Editor] Post-create UI update failed:`, err)
  }
}
