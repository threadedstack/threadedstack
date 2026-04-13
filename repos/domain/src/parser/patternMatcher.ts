import type { TPatternMatcher, TParsedEvent } from '@TDM/types'

export class PatternMatcherPipeline {
  private matchers: TPatternMatcher[]
  private onEvent: (event: TParsedEvent) => void

  constructor(matchers: TPatternMatcher[], onEvent: (event: TParsedEvent) => void) {
    this.matchers = matchers
    this.onEvent = onEvent
  }

  process(text: string) {
    for (const matcher of this.matchers) {
      const event = matcher.match(text)
      if (event) {
        this.onEvent(event)
        return
      }
    }

    if (this.matchers.length === 0) {
      this.onEvent({ type: `unknown`, raw: text, timestamp: Date.now() })
    } else {
      this.onEvent({ type: `text`, content: text, timestamp: Date.now() })
    }
  }

  tryMatch(text: string): TParsedEvent | null {
    for (const matcher of this.matchers) {
      const event = matcher.match(text)
      if (event) return event
    }
    return null
  }
}
