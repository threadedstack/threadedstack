/**
 * Splits string by delimiter
 */
export const splitBy = (str: string | undefined, delimiter: string = `,`): string[] => {
  if (!str?.trim()) return []
  return str.split(delimiter).map((s) => s)
}

/**
 * Splits string by delimiter, then trims, and removes empties
 */
export const cleanSplit = (
  str: string | undefined,
  delimiter: string = `,`
): string[] => {
  if (!str?.trim()) return []
  return str
    .split(delimiter)
    .map((s) => s.trim())
    .filter(Boolean)
}
