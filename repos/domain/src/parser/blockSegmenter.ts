import type { TBlock, TSegmenterState } from '@TDM/types'
import { PromptRegEx } from '@TDM/constants/parser'

export class BlockSegmenter {
  private buffer = ``
  private state: TSegmenterState = `waiting`
  private pendingSent: Set<string> = new Set()
  private onBlock: (block: TBlock) => void

  constructor(onBlock: (block: TBlock) => void) {
    this.onBlock = onBlock
  }

  getState(): TSegmenterState {
    return this.state
  }

  markSent(text: string) {
    this.pendingSent.add(text.trim())
  }

  feed(data: string) {
    this.buffer += data
    this.processBuffer()
  }

  flush() {
    if (this.buffer.trim()) {
      this.emitBlock(this.buffer)
      this.buffer = ``
    }
  }

  private processBuffer() {
    const lines = this.buffer.split(`\n`)
    // Keep the last element — it`s either empty (line ended with \n) or a partial line
    this.buffer = lines.pop() ?? ``

    for (const line of lines) {
      this.emitBlock(line)
    }

    // Check if remaining buffer looks like a prompt
    if (PromptRegEx.test(this.buffer)) this.state = `waiting`
  }

  private emitBlock(raw: string) {
    const content = raw.trim()
    if (!content) return

    const isInput = this.pendingSent.has(content)
    if (isInput) this.pendingSent.delete(content)

    if (!isInput) this.state = `outputting`

    this.onBlock({
      content,
      timestamp: Date.now(),
      type: isInput ? `input` : `output`,
    })
  }
}
