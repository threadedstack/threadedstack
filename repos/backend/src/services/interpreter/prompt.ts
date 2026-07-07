import { InterpreterSystem, EParserEvtType } from '@tdsk/domain'
import type { TParsedEvent, TGuiConfig } from '@tdsk/domain'

export function getSystemPrompt(config: TGuiConfig): string {
  return config.systemPrompt?.trim() || InterpreterSystem
}

export function buildUserMessage(events: TParsedEvent[]): string {
  return events
    .map((e) => {
      if (e.type === EParserEvtType.Text) return e.content
      if (e.type === EParserEvtType.Unknown) return e.raw
      if (e.type === EParserEvtType.Error) return `Error: ${e.message}`
      if (e.type === EParserEvtType.ToolCall) return `⏺ ${e.tool} ${e.target}`
      if (e.type === EParserEvtType.Permission) return e.prompt
      if (e.type === EParserEvtType.Diff) {
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
