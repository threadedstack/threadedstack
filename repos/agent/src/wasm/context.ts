import type { TMessage, TContextOpts } from '@TAG/types'

/**
 * Context class for managing conversation history and token limits
 * Implements "Middle-Out" truncation strategy
 */
export class Context {
  max: number

  constructor(opts?: TContextOpts) {
    this.max = opts?.max ?? 100000
  }

  /**
   * Compose system prompt and messages with token budget management
   * Uses "Middle-Out" truncation: Keep system prompt + recent messages
   */
  compose = (
    sys: string,
    history: TMessage[]
  ): { system: string; messages: TMessage[] } => {
    // Estimate tokens (rough: 1 token ≈ 4 chars)
    const sysLen = Math.ceil(sys.length / 4)
    let budget = this.max - sysLen
    const keep: TMessage[] = []

    // Start from most recent and work backwards
    for (let i = history.length - 1; i >= 0; i--) {
      const len = Math.ceil(history[i].content.length / 4)
      if (budget - len < 0) break
      budget -= len
      keep.unshift(history[i])
    }

    return { system: sys, messages: keep }
  }

  /**
   * Format content with truncation for large outputs
   */
  format = (name: string, content: string): string => {
    const lines = content.split('\n')
    if (lines.length > 500) {
      return `--- CONTEXT: ${name} ---\n${lines.slice(0, 100).join('\n')}\n...[truncated ${lines.length - 200} lines]...\n${lines.slice(-100).join('\n')}\n--- END ---`
    }
    return `--- CONTEXT: ${name} ---\n${content}\n--- END ---`
  }

  /**
   * Calculate approximate token count for a string
   */
  estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4)
  }

  /**
   * Check if content fits within budget
   */
  fitsInBudget = (text: string, budget: number): boolean => {
    return this.estimateTokens(text) <= budget
  }
}
