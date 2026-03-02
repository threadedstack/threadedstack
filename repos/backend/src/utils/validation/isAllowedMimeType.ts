import { FileAllowedMimeTypes, FileAllowedMimePrefixes } from '@TBE/constants/values'

export const isAllowedMimeType = (mimeType: string): boolean =>
  FileAllowedMimePrefixes.some((p) => mimeType.startsWith(p)) ||
  FileAllowedMimeTypes.has(mimeType)
