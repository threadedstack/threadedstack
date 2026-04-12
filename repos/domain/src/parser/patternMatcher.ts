import type { TBlock, TPatternMatcher, TParsedEvent } from '@TDM/types'

export class PatternMatcherPipeline {
  private matchers: TPatternMatcher[]
  private onEvent: (event: TParsedEvent) => void

  constructor(matchers: TPatternMatcher[], onEvent: (event: TParsedEvent) => void) {
    this.matchers = matchers
    this.onEvent = onEvent
  }

  process(block: TBlock) {
    if (block.type === `input`) {
      this.onEvent({ type: `input`, content: block.content, timestamp: block.timestamp })
      return
    }

    for (const matcher of this.matchers) {
      const event = matcher.match(block.content)
      if (event) {
        this.onEvent(event)
        return
      }
    }

    if (this.matchers.length === 0) {
      this.onEvent({ type: `unknown`, raw: block.content, timestamp: block.timestamp })
    } else {
      this.onEvent({ type: `text`, content: block.content, timestamp: block.timestamp })
    }
  }
}
