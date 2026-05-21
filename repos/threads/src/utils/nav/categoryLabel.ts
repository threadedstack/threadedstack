import type { TClassifiedSession } from '@TTH/types'

export const categoryLabel = (session: TClassifiedSession) => {
  switch (session.category) {
    case `connected`:
      return `Active`
    case `disconnected`:
      return session.hasShellSession ? `Idle` : `Expired`
    case `shared`:
      return `Shared`
  }
}
