import { ExtMap, FilenameMap, BinaryExtensions } from '@TTH/constants/monaco'

const basename = (path: string): string => {
  const parts = path.split(`/`)
  return parts[parts.length - 1] || ``
}

export const detectLanguage = (path: string): string => {
  const filename = basename(path)

  const mapped = FilenameMap.get(filename)
  if (mapped) return mapped

  const dotIndex = filename.lastIndexOf(`.`)
  if (dotIndex < 0) return `plaintext`

  const ext = filename.slice(dotIndex + 1).toLowerCase()
  return ExtMap.get(ext) ?? `plaintext`
}

export const isBinaryFile = (path: string): boolean => {
  const filename = basename(path)
  const dotIndex = filename.lastIndexOf(`.`)
  if (dotIndex < 0) return false
  return BinaryExtensions.has(filename.slice(dotIndex + 1).toLowerCase())
}
