import { InterpreterSystem } from '@tdsk/domain'
import type { TParsedEvent, TGuiConfig } from '@tdsk/domain'

export function getSystemPrompt(config: TGuiConfig): string {
  return config.systemPrompt?.trim() || InterpreterSystem
}

export function buildUserMessage(events: TParsedEvent[]): string {
  return events
    .map((e) => {
      if (e.type === 'text') return e.content
      if (e.type === 'unknown') return e.raw
      if (e.type === 'error') return `Error: ${e.message}`
      if (e.type === 'tool-call') return `⏺ ${e.tool} ${e.target}`
      if (e.type === 'permission') return e.prompt
      if (e.type === 'diff') {
        const lines = [
          ...e.additions.map((l) => `+ ${l}`),
          ...e.removals.map((l) => `- ${l}`),
        ]
        return lines.join('\n')
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}
