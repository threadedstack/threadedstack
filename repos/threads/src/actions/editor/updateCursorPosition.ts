import type { TCursorPosition } from '@TTH/types'

import { setCursorPosition } from '@TTH/state/accessors'

export const updateCursorPosition = (pos: TCursorPosition) => {
  setCursorPosition(pos)
}
