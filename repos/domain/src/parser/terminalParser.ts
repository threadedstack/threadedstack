import type { TParsedEvent, TTerminalParserOpts } from '@TDM/types'

import { GhosttyVT } from '@TDM/parser/ghosttyVT'
import type { VTerminal } from '@TDM/parser/ghosttyVT'
import { ChangeDetector } from '@TDM/parser/changeDetector'
import { PatternMatcherPipeline } from '@TDM/parser/patternMatcher'
import { getMatchers } from '@TDM/parser/matchers'

const maxRawBufferSize = 10 * 1024 * 1024

export class TerminalParser {
  private terminal: VTerminal
  private detector: ChangeDetector
  private rawBuffer: Uint8Array[] = []
  private rawBufferSize = 0
  private onEvent: (event: TParsedEvent) => void
  private encoder = new TextEncoder()

  constructor(opts: TTerminalParserOpts) {
    this.onEvent = opts.onEvent

    const matchers = getMatchers(opts.runtime)
    const pipeline = new PatternMatcherPipeline(matchers, (event) => {
      this.onEvent(event)
    })

    this.terminal = GhosttyVT.createTerminal(opts.cols ?? 80, opts.rows ?? 24)

    this.detector = new ChangeDetector(
      this.terminal,
      (sealedLine) => pipeline.process(sealedLine),
      (activeText) => {
        // Check if the active row matches a significant pattern (e.g. prompt-ready)
        // If it does, emit that event. Otherwise emit activity.
        const event = pipeline.tryMatch(activeText)
        if (event && event.type !== `text`) {
          this.onEvent(event)
        } else {
          this.onEvent({ type: `activity`, timestamp: Date.now() })
        }
      },
      () => this.onEvent({ type: `activity`, timestamp: Date.now() })
    )
  }

  write(data: string | Uint8Array) {
    const bytes = typeof data === `string` ? this.encoder.encode(data) : data
    this.rawBufferSize += bytes.length
    this.rawBuffer.push(bytes)
    while (this.rawBufferSize > maxRawBufferSize && this.rawBuffer.length > 1) {
      this.rawBufferSize -= this.rawBuffer.shift()!.length
    }
    this.terminal.write(bytes)
    this.detector.process()
  }

  flush() {
    this.detector.flush()
  }

  getRawBuffer(): Uint8Array {
    const totalLength = this.rawBuffer.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of this.rawBuffer) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  }

  resize(cols: number, rows: number) {
    this.terminal.resize(cols, rows)
  }

  isAlternateScreen(): boolean {
    return this.terminal.isAlternateScreen()
  }

  destroy() {
    this.terminal.free()
    this.rawBuffer.length = 0
    this.rawBufferSize = 0
  }
}
