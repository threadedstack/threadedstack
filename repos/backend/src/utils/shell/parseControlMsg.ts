import type { TShellControlMsg } from '@TBE/types'

import { isObj } from '@keg-hub/jsutils/isObj'
import { isInt } from '@keg-hub/jsutils/isInt'
import { MaxTerminalDim } from '@TBE/constants/sandbox'
import { ESandboxSessionVisibility } from '@tdsk/domain'

/**
 * Parse and validate a raw WebSocket text frame into a TShellControlMsg.
 * Returns null for malformed or invalid messages.
 */
export const parseShellControlMsg = (raw: string): TShellControlMsg | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isObj(parsed)) return null

  const obj = parsed as Record<string, unknown>
  const type = obj.type

  switch (type) {
    case `resize`: {
      const { cols, rows } = obj
      if (
        !isInt(cols) ||
        !isInt(rows) ||
        cols < 1 ||
        rows < 1 ||
        cols > MaxTerminalDim ||
        rows > MaxTerminalDim
      ) {
        return null
      }
      return { type: `resize`, cols, rows }
    }

    case `signal`: {
      const { signal } = obj
      if (signal !== `SIGINT` && signal !== `SIGTSTP`) return null
      return { type: `signal`, signal }
    }

    case `visibility`: {
      const { visibility } = obj
      if (
        !Object.values(ESandboxSessionVisibility).includes(
          visibility as ESandboxSessionVisibility
        )
      ) {
        return null
      }
      return { type: `visibility`, visibility: visibility as ESandboxSessionVisibility }
    }

    case `permission-response`: {
      const { response } = obj
      if (response !== `y` && response !== `n`) return null
      return { type: `permission-response`, response }
    }

    default:
      return null
  }
}
