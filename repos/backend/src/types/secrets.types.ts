import type { Secret } from '@tdsk/domain'

type TDbError = { message: string }

export type TSecretResolverDb = {
  services: {
    secret: {
      get: (id: string) => Promise<{ data?: Secret; error?: TDbError }>
      list: (opts: { where: Record<string, string> }) => Promise<{
        data?: Secret[]
        error?: TDbError
      }>
    }
  }
}
