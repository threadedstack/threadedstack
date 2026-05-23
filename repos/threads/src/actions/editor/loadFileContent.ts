import type { TFileCacheEntry } from '@TTH/types'

import { fileService } from '@TTH/services/fileService'
import { isBinaryFile } from '@TTH/utils/editor/detectLanguage'
import { getFileCtx } from '@TTH/actions/editor/getFileCtx'
import { getFileContentCache, setFileContentCache } from '@TTH/state/accessors'

const MaxFileSize = 2 * 1024 * 1024

const setEntry = (filePath: string, entry: TFileCacheEntry) => {
  const updated = new Map(getFileContentCache())
  updated.set(filePath, entry)
  setFileContentCache(updated)
}

export const loadFileContent = async (filePath: string) => {
  const cache = getFileContentCache()
  const existing = cache.get(filePath)
  if (existing && existing.status !== `error`) return

  if (isBinaryFile(filePath)) {
    setEntry(filePath, { status: `error`, error: `Binary file` })
    return
  }

  const ctx = getFileCtx()
  if (!ctx) {
    setEntry(filePath, { status: `error`, error: `No active sandbox session` })
    return
  }

  setEntry(filePath, { status: `loading` })

  try {
    const size = await fileService.fileSize(ctx, filePath)
    if (size > MaxFileSize) {
      setEntry(filePath, {
        status: `error`,
        error: `File too large (${(size / 1024 / 1024).toFixed(1)}MB)`,
      })
      return
    }

    const content = await fileService.readFile(ctx, filePath)
    setEntry(filePath, { status: `loaded`, content })
  } catch (err) {
    setEntry(filePath, {
      status: `error`,
      error: err instanceof Error ? err.message : `Failed to load file`,
    })
  }
}
