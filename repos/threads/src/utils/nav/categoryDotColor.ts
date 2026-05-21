import type { TClassifiedSession } from '@TTH/types'

import { colors } from '@tdsk/components'

type PaletteColor = { main: string }

export const categoryDotColor = (
  session: TClassifiedSession,
  palette: { success: PaletteColor; warning: PaletteColor; info: PaletteColor }
) => {
  switch (session.category) {
    case `connected`:
      return palette.success.main
    case `disconnected`:
      return session.hasShellSession ? palette.warning.main : colors.grey[600]
    case `shared`:
      return palette.info.main
  }
}
