import { getFileContentCache, setFileContentCache } from '@TTH/state/accessors'

export const markFileDirty = (filePath: string, content: string) => {
  const cache = new Map(getFileContentCache())
  const entry = cache.get(filePath)
  if (!entry || entry.status === `loading` || entry.status === `error`) return

  cache.set(filePath, { status: `dirty`, content })
  setFileContentCache(cache)
}
