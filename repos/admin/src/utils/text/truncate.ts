export const truncate = (text: string | undefined, maxLen: number): string => {
  if (!text) return `-`
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}...`
}
