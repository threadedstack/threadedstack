import { InteractivePatterns, EParserEvtType } from '@tdsk/domain'
import type { TParsedEvent } from '@tdsk/domain'

export function shouldInterpret(events: TParsedEvent[]): boolean {
  const text = events
    .filter(
      (
        e
      ): e is
        | Extract<TParsedEvent, { type: `${EParserEvtType.Text}` }>
        | Extract<TParsedEvent, { type: `${EParserEvtType.Unknown}` }> =>
        e.type === EParserEvtType.Text || e.type === EParserEvtType.Unknown
    )
    .map((e) => ('content' in e ? e.content : 'raw' in e ? e.raw : ''))
    .join('\n')

  if (!text.trim()) return false

  return InteractivePatterns.some((pattern) => pattern.test(text))
}
