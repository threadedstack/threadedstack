import { exists } from '@keg-hub/jsutils/exists'
import { isValidUrl } from '@keg-hub/jsutils/isValidUrl'

export const validateUrl = (url: string) => {
  if (!exists(url)) return undefined
  if (!isValidUrl(url))
    throw new Error(`Can not load API. configured URL is invalid: ${url}`)

  return url
}
