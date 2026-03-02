import { Exception, EProvider } from '@tdsk/domain'

const validTypes = Object.values(EProvider) as string[]
export const validateProviderType = (type?: string) => {
  if (!type || !validTypes.includes(type))
    throw new Exception(
      400,
      `Invalid provider type: "${type}", must be one of: ${validTypes.join(`, `)}`
    )
}
