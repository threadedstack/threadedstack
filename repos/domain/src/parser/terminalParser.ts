import type { TParsedEvent, TTerminalParserOpts } from '@TDM/types'

import { GhosttyVT } from '@TDM/parser/ghosttyVT'
import type { VTerminal } from '@TDM/parser/ghosttyVT'
import { ChangeDetector } from '@TDM/parser/changeDetector'
import { PatternMatcherPipeline } from '@TDM/parser/patternMatcher'
import { getMatchers } from '@TDM/parser/matchers'
import { classifyContent } from '@TDM/parser/contentFilter'
import { segmentsToMarkdown, hasFormatting } from '@TDM/parser/markdownFormatter'

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
      // Reset dedup cache on prompt-ready — new content cycle
      if (event.type === 'prompt-ready') {
        this.detector.resetDedup()
      }
      this.onEvent(event)
    })

    this.terminal = GhosttyVT.createTerminal(opts.cols ?? 80, opts.rows ?? 24)

    // Drain initial dirty state from terminal creation (clear-screen
    // escape) so the first write() starts with a clean slate.
    this.terminal.getDirtyRows()
    this.terminal.markClean()

    this.detector = new ChangeDetector(
      this.terminal,
      (sealedLine, row) => {
        // Classify content before passing to pattern matchers
        const classification = classifyContent(sealedLine, opts.runtime)
        if (classification === 'chrome') return
        if (classification === 'loading') {
          this.onEvent({ type: `activity`, timestamp: Date.now() })
          return
        }

        // Try pattern matchers on the raw text first. Tool calls, errors,
        // permissions, and prompts don't need markdown formatting — they
        // have their own dedicated event types and UI components.
        const specialEvent = pipeline.tryMatch(sealedLine)
        if (specialEvent && specialEvent.type !== 'text') {
          pipeline.process(sealedLine)
          return
        }

        // For text events, check if the line has ANSI bold/italic
        // formatting and convert to markdown inline syntax.
        const segments = this.terminal.getLineSegments(row)
        if (segments.length > 0 && hasFormatting(segments)) {
          const md = segmentsToMarkdown(segments)
          if (md.length > 0) {
            pipeline.process(md)
            return
          }
        }

        // No formatting — pass plain text as-is
        pipeline.process(sealedLine)
      },
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
