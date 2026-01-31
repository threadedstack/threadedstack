import type { TKeyValuePair } from '@TAF/types'

/**
 * Parses JSON - tries JSON parse first, catches and falls back to string
 */
export const safeJson = (value: string): any => {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

/**
 * Converts KV pairs arguments array to object with JSON parsing
 */
export const kvToObj = (
  pairs: TKeyValuePair[],
  json: boolean = true
): Record<string, any> => {
  const obj: Record<string, any> = {}
  pairs.forEach((pair) => {
    const key = pair.key.trim()
    const val = pair.value.trim()
    if (key && val) obj[key] = json ? safeJson(val) : val
  })
  return obj
}

/**
 * Converts an object to TKeyValuePair array with generated IDs
 */
export const objToKV = (
  obj: Record<string, any> | undefined,
  idPrefix: string
): TKeyValuePair[] => {
  if (!obj) return []

  return Object.entries(obj).map(([key, value], index) => ({
    id: `${idPrefix}-${index}-${Date.now()}`,
    key,
    value: String(value),
  }))
}
