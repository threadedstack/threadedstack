export const shortId = (id: string, prefix?: string): string => {
  if (!id) return `-`
  const suffix = id.split(`-`).pop()?.slice(0, 4) ?? id.slice(-4)
  return prefix ? `${prefix}-${suffix}` : suffix
}
