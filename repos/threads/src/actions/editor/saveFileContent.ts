import { toast } from 'sonner'
import { fileService } from '@TTH/services/fileService'
import { getFileCtx } from '@TTH/actions/editor/getFileCtx'
import {
  getFileContentCache,
  setFileContentCache,
  getSavingFiles,
  setSavingFiles,
} from '@TTH/state/accessors'

export const saveFileContent = async (filePath: string) => {
  const cache = getFileContentCache()
  const entry = cache.get(filePath)
  if (!entry || entry.status !== `dirty`) return

  const ctx = getFileCtx()
  if (!ctx) {
    toast.error(`Cannot save file`, { description: `No active sandbox session` })
    return
  }

  const saving = new Set(getSavingFiles())
  saving.add(filePath)
  setSavingFiles(saving)

  try {
    await fileService.writeFile(ctx, filePath, entry.content)

    const updated = new Map(getFileContentCache())
    const current = updated.get(filePath)
    // Only clear dirty if the cache still holds what we just wrote — an edit
    // made while the write was in flight leaves current.content ahead of
    // entry.content, and that newer content still needs to be saved.
    if (
      current &&
      (current.status === `dirty` || current.status === `loaded`) &&
      current.content === entry.content
    ) {
      updated.set(filePath, { status: `loaded`, content: current.content })
      setFileContentCache(updated)
    }
  } catch (err) {
    toast.error(`Failed to save file`, {
      description: err instanceof Error ? err.message : `An unexpected error occurred`,
    })
  } finally {
    const updatedSaving = new Set(getSavingFiles())
    updatedSaving.delete(filePath)
    setSavingFiles(updatedSaving)
  }
}
