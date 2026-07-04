import type { AgentMessage, StreamFn } from '@earendil-works/pi-agent-core'
import type { Api, Model } from '@earendil-works/pi-ai'

import { logger } from '@TAG/utils/logger'

/**
 * Rough token estimator: ~4 characters per token for English text.
 * Accurate enough for context budget enforcement.
 */
const estimateTokens = (text: string): number => Math.ceil(text.length / 4)

/**
 * Estimate token count for a single AgentMessage.
 */
const estimateMessageTokens = (msg: AgentMessage): number => {
  if (`content` in msg && typeof msg.content === `string`)
    return estimateTokens(msg.content)

  if (`content` in msg && Array.isArray(msg.content)) {
    return (msg.content as Array<{ type: string; text?: string }>).reduce(
      (sum, block) => {
        if (block.type === `text` && block.text) return sum + estimateTokens(block.text)
        if (block.type === `toolCall`) return sum + 100 // Rough estimate for tool call overhead
        return sum + 20
      },
      0
    )
  }

  return 50 // Default for unknown message shapes
}

/**
 * Compaction options for context management.
 */
export type TCompactionOpts = {
  strategy: `prune` | `compact`
  streamFn?: StreamFn
  compactionModel?: string
  /**
   * Fire-and-forget callback invoked with the compaction summary once produced.
   * Used to persist the otherwise-discarded summary as a durable memory.
   * Errors thrown by the callback are swallowed and never break the transform.
   */
  onSummary?: (summary: string) => void | Promise<void>
}

/**
 * Create a transformContext function that manages messages within
 * a percentage of the model's context window.
 *
 * Strategies:
 *   prune   — drops oldest messages (keeps anchors + recent)
 *   compact — summarizes oldest messages via LLM, keeps summary + recent
 */
export const createContextManager = (
  model: Model<Api>,
  budgetPercent: number = 80,
  compaction?: TCompactionOpts
) => {
  const maxTokens = Math.floor(model.contextWindow * (budgetPercent / 100))

  return async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
    const totalEstimate = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)

    // If within budget, return all messages
    if (totalEstimate <= maxTokens) return messages

    // Keep first 2 messages (anchors) + as many recent messages as fit
    const anchors = messages.slice(0, Math.min(2, messages.length))
    const anchorTokens = anchors.reduce((sum, m) => sum + estimateMessageTokens(m), 0)

    const remaining = messages.slice(anchors.length)
    const budget = maxTokens - anchorTokens

    // Use compact strategy if configured and streamFn is available
    if (compaction?.strategy === `compact` && compaction.streamFn) {
      return compactMessages(
        anchors,
        remaining,
        budget,
        compaction.streamFn,
        model,
        compaction.onSummary
      )
    }

    // Default: prune strategy — keep most recent messages that fit
    return pruneMessages(anchors, remaining, budget)
  }
}

/**
 * Prune strategy: walk from most recent backward, keep messages that fit budget.
 */
const pruneMessages = (
  anchors: AgentMessage[],
  remaining: AgentMessage[],
  budget: number
): AgentMessage[] => {
  const kept: AgentMessage[] = []
  let used = 0

  for (let i = remaining.length - 1; i >= 0; i--) {
    const cost = estimateMessageTokens(remaining[i])
    if (used + cost > budget) break
    kept.unshift(remaining[i])
    used += cost
  }

  return [...anchors, ...kept]
}

/**
 * Compact strategy: summarize old messages via LLM, keep summary + recent messages.
 * Splits remaining messages into "old" (to summarize) and "recent" (to keep verbatim).
 */
const compactMessages = async (
  anchors: AgentMessage[],
  remaining: AgentMessage[],
  budget: number,
  streamFn: StreamFn,
  model: Model<Api>,
  onSummary?: (summary: string) => void | Promise<void>
): Promise<AgentMessage[]> => {
  // Reserve ~20% of budget for the compaction summary itself
  const summaryBudget = Math.floor(budget * 0.2)
  const recentBudget = budget - summaryBudget

  // Walk from most recent backward to find "recent" messages
  const recent: AgentMessage[] = []
  let recentUsed = 0
  let splitIndex = remaining.length

  for (let i = remaining.length - 1; i >= 0; i--) {
    const cost = estimateMessageTokens(remaining[i])
    if (recentUsed + cost > recentBudget) {
      splitIndex = i + 1
      break
    }
    recent.unshift(remaining[i])
    recentUsed += cost
    if (i === 0) splitIndex = 0
  }

  const old = remaining.slice(0, splitIndex)

  // If nothing to compact, just prune
  if (old.length === 0) {
    return [...anchors, ...recent]
  }

  // Summarize old messages via LLM
  try {
    const summary = await summarizeMessages(old, streamFn, model)
    if (!summary.trim()) {
      throw new Error(`Compaction produced empty summary`)
    }

    // Fire-and-forget summary persistence; never let it break the transform.
    if (onSummary) {
      try {
        void Promise.resolve(onSummary(summary)).catch((err) => {
          logger.warn(`Compaction onSummary callback failed: ${err}`)
        })
      } catch (err) {
        logger.warn(`Compaction onSummary callback threw: ${err}`)
      }
    }

    const summaryMsg: AgentMessage = {
      role: `user`,
      content: `[Summary of earlier conversation]\n${summary}`,
      timestamp: Date.now(),
    } as any

    return [...anchors, summaryMsg, ...recent]
  } catch (err) {
    // If summarization fails, fall back to prune strategy
    logger.warn(`Context compaction failed, falling back to prune: ${err}`)
    return pruneMessages(anchors, remaining, budget)
  }
}

/**
 * Summarize a list of messages by streaming a summarization prompt
 * through the same streamFn used for the main agent.
 */
const summarizeMessages = async (
  messages: AgentMessage[],
  streamFn: StreamFn,
  model: Model<Api>
): Promise<string> => {
  // Build a text representation of the messages to summarize
  const contextText = messages
    .map((m) => {
      const role = m.role
      const content =
        `content` in m
          ? typeof m.content === `string`
            ? m.content
            : Array.isArray(m.content)
              ? (m.content as Array<{ type?: string; text?: string }>)
                  .filter((b) => b.type === `text` && b.text)
                  .map((b) => b.text)
                  .join(`\n`) || `[tool call]`
              : String(m.content)
          : `[no content]`
      return `${role}: ${content}`
    })
    .join(`\n`)

  const summaryPrompt = `Summarize the following conversation excerpt concisely. Preserve key facts, decisions, tool results, and any important context that would be needed to continue the conversation:\n\n${contextText}`

  const stream = await streamFn(
    model,
    {
      systemPrompt: `You are a conversation summarizer. Provide a concise but complete summary. Focus on facts and decisions, not conversational style.`,
      messages: [
        { role: `user`, content: summaryPrompt, timestamp: Date.now() },
      ] as any[],
    },
    {}
  )

  let text = ``
  for await (const event of stream) {
    if (event.type === `text_delta`) {
      text += event.delta
    }
  }

  return text
}

/**
 * Legacy alias for backward compatibility.
 * @deprecated Use createContextManager instead.
 */
export const createContextPruner = createContextManager
