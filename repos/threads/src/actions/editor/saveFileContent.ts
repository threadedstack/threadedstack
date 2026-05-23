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
    if (current && (current.status === `dirty` || current.status === `loaded`)) {
      updated.set(filePath, { status: `loaded`, content: current.content })
    }
    setFileContentCache(updated)
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
