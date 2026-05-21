import { exists } from '@keg-hub/jsutils/exists'

export const getInitials = (name?: string): string => {
  if (!exists(name) || name === `` || name === `undefined`) return `?`
  const parts = name
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .slice(0, 2)
  if (parts.length === 0) return `?`
  return parts
    .map((p) => p[0])
    .join(``)
    .toUpperCase()
}
