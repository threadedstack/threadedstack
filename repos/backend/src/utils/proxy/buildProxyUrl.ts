import { isValidUrl } from '@keg-hub/jsutils'

/**
 * Generates the backend API url based on the current ENVs
 */
export const buildProxyUrl = (
  host: string | undefined,
  port: string | undefined
): string => {
  if (!host) return undefined

  const portStr = port ? `:${port}` : ``

  return isValidUrl(host) ? `${host}${portStr}` : `http://${host}${portStr}`
}
