import type { TParsedEvent, TToolState } from '@TDM/types/parser.types'

export const deriveToolState = (
  event: TParsedEvent,
  opts?: { lastRunningTool?: string }
): TToolState | null => {
  switch (event.type) {
    case 'tool-call':
      return 'working'
    case 'text':
    case 'diff':
      if (opts?.lastRunningTool === 'Bash') return 'interactive'
      return 'working'
    case 'activity':
      return 'working'
    case 'input':
      return null
    case 'permission':
      return 'permission'
    case 'prompt-ready':
      return 'prompt'
    case 'error':
      return 'prompt'
    default:
      return null
  }
}
