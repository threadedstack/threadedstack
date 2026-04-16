import type { TParsedEvent, TToolState } from '@TDM/types/parser.types'

/**
 * Patterns that indicate the terminal is waiting for user input.
 * More selective than the Generative UI InteractivePatterns — these
 * only match clear "waiting for keystroke" signals, not generic lists.
 */
const TerminalWaitingPatterns = [
  // Confirmation prompts: (y/n), [Y/n], (yes/no)
  /\(y\/n\)|\[Y\/n\]|\[y\/N\]|\(yes\/no\)/i,

  // "Press Enter" / "Enter to continue" prompts
  /press\s+enter|enter\s+to\s+continue/i,

  // "Esc to cancel/interrupt" prompts
  /esc\s+to\s+(?:cancel|interrupt|stop)/i,

  // Cursor/selection markers — terminal is showing a selection menu
  /[❯›]\s+\S/,
]

function hasInteractivePrompt(text: string): boolean {
  return TerminalWaitingPatterns.some((p) => p.test(text))
}

export const deriveToolState = (
  event: TParsedEvent,
  opts?: { lastRunningTool?: string }
): TToolState | null => {
  switch (event.type) {
    case 'tool-call':
      return 'working'
    case 'text':
      if (hasInteractivePrompt(event.content)) return 'interactive'
      if (opts?.lastRunningTool === 'Bash') return 'interactive'
      return 'working'
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
    case 'unknown':
      if (hasInteractivePrompt(event.raw)) return 'interactive'
      return null
    default:
      return null
  }
}
