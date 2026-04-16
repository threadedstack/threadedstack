import { InteractivePatterns } from '@tdsk/domain'
import type { TParsedEvent } from '@tdsk/domain'

export function shouldInterpret(events: TParsedEvent[]): boolean {
  const text = events
    .filter(
      (
        e
      ): e is
        | Extract<TParsedEvent, { type: 'text' }>
        | Extract<TParsedEvent, { type: 'unknown' }> =>
        e.type === 'text' || e.type === 'unknown'
    )
    .map((e) => ('content' in e ? e.content : 'raw' in e ? e.raw : ''))
    .join('\n')

  if (!text.trim()) return false

  return InteractivePatterns.some((pattern) => pattern.test(text))
}
