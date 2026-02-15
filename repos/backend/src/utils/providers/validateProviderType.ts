import { EProvider } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'

const validTypes = Object.values(EProvider) as string[]
export const validateProviderType = (type?: string) => {
  if (!type || !validTypes.includes(type))
    throw new Exception(
      400,
      `Invalid provider type: "${type}", must be one of: ${validTypes.join(`, `)}`
    )
}
