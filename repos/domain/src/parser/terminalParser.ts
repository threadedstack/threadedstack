import type {
  TToolState,
  TParsedEvent,
  TPatternMatcher,
  TTerminalParserOpts,
} from '@TDM/types'

import { stripAnsi } from '@TDM/parser/ansiProcessor'
import { BlockSegmenter } from '@TDM/parser/blockSegmenter'
import { PatternMatcherPipeline } from '@TDM/parser/patternMatcher'
import { claudeCodeMatchers } from '@TDM/parser/matchers/claudeCode'

const matchersByRuntime: Record<string, TPatternMatcher[]> = {
  'claude-code': claudeCodeMatchers,
}

export class TerminalParser {
  private pendingData = ``
  private debounceMs: number
  private rawBuffer: string[] = []
  private segmenter: BlockSegmenter
  private toolState: TToolState = `idle`
  private pipeline: PatternMatcherPipeline
  private onEvent: (event: TParsedEvent) => void
  private onToolState: (state: TToolState) => void
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  private thinkingTimer: ReturnType<typeof setTimeout> | null = null
  private thinkingDelayMs: number
  private lastRunningToolCall: (TParsedEvent & { type: 'tool-call' }) | null = null

  constructor(opts: TTerminalParserOpts) {
    this.onEvent = opts.onEvent
    this.onToolState = opts.onToolState
    this.debounceMs = opts.debounceMs ?? 100
    this.thinkingDelayMs = opts.thinkingDelayMs ?? 2000

    const matchers = matchersByRuntime[opts.runtime] ?? []

    this.pipeline = new PatternMatcherPipeline(matchers, (event) => {
      this.cancelThinkingTimer()
      this.maybeCompleteToolCall(event)
      this.onEvent(event)
      this.updateToolState(event)

      if (event.type === `tool-call` && event.status === `running`) {
        this.lastRunningToolCall = event as TParsedEvent & { type: `tool-call` }
      }
    })

    this.segmenter = new BlockSegmenter((block) => {
      this.pipeline.process(block)
    })
  }

  write(data: string) {
    this.rawBuffer.push(data)

    if (this.debounceMs === 0) {
      this.processData(data)
      return
    }

    this.pendingData += data
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.processData(this.pendingData)
      this.pendingData = ``
    }, this.debounceMs)
  }

  private processData(data: string) {
    const clean = stripAnsi(data)
    this.segmenter.feed(clean)
  }

  trackInput(text: string) {
    this.segmenter.markSent(text)
    this.startThinkingTimer()
  }

  flush() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.pendingData) {
      this.processData(this.pendingData)
      this.pendingData = ''
    }
    this.segmenter.flush()
    this.completeAnyRunningToolCall()
  }

  getRawBuffer(): string {
    return this.rawBuffer.join('')
  }

  getToolState(): TToolState {
    return this.toolState
  }

  private startThinkingTimer() {
    this.cancelThinkingTimer()
    if (this.thinkingDelayMs <= 0) return

    this.thinkingTimer = setTimeout(() => {
      this.thinkingTimer = null
      const event: TParsedEvent = { type: `thinking`, timestamp: Date.now() }
      this.onEvent(event)
      this.updateToolState(event)
    }, this.thinkingDelayMs)
  }

  private cancelThinkingTimer() {
    if (this.thinkingTimer) {
      clearTimeout(this.thinkingTimer)
      this.thinkingTimer = null
    }
  }

  private maybeCompleteToolCall(incomingEvent: TParsedEvent) {
    if (!this.lastRunningToolCall) return

    const completionTriggers = [`tool-call`, `prompt-ready`, `permission`, `error`]
    if (completionTriggers.includes(incomingEvent.type)) {
      const done: TParsedEvent = {
        ...this.lastRunningToolCall,
        status: `done`,
        timestamp: Date.now(),
      }
      this.onEvent(done)
      this.lastRunningToolCall = null
    }
  }

  private completeAnyRunningToolCall() {
    if (!this.lastRunningToolCall) return
    const done: TParsedEvent = {
      ...this.lastRunningToolCall,
      status: `done`,
      timestamp: Date.now(),
    }
    this.onEvent(done)
    this.lastRunningToolCall = null
  }

  private updateToolState(event: TParsedEvent) {
    let newState: TToolState | null = null

    switch (event.type) {
      case `tool-call`:
        newState = `working`
        break
      case `text`:
      case `diff`:
        if (this.lastRunningToolCall?.tool === `Bash`) {
          newState = `interactive`
        } else {
          newState = `working`
        }
        break
      case `thinking`:
        newState = `working`
        break
      case `permission`:
        newState = `permission`
        break
      case `prompt-ready`:
        newState = `prompt`
        break
      case `error`:
        newState = `prompt`
        break
    }

    if (newState && newState !== this.toolState) {
      this.toolState = newState
      this.onToolState(newState)
    }
  }
}
