import type { TLLMAdapterConfig, TLLMToolDef, TStreamStopReason } from '@tdsk/domain'
import { OpenAICompatibleAdapter } from './openai-compatible'

type TZaiOptions = {
  thinking?: boolean
  thinkingBudget?: number
  doSample?: boolean
  toolStream?: boolean
  webSearch?: Record<string, unknown>
}

/**
 * Z.AI LLM adapter for GLM models
 * Extends OpenAI-compatible base with z.ai-specific features:
 * - thinking mode (chain-of-thought)
 * - do_sample control (greedy decoding)
 * - tool_stream (GLM-4.6 only)
 * - built-in web_search tool
 * - custom finish reasons (sensitive, network_error)
 */
export class ZaiAdapter extends OpenAICompatibleAdapter {
  readonly provider = `zai` as const

  protected getBaseUrl(_config: TLLMAdapterConfig): string {
    return `https://api.z.ai/api/paas/v4`
  }

  protected getExtraBody(
    config: TLLMAdapterConfig,
    _tools: TLLMToolDef[]
  ): Record<string, unknown> {
    const opts = (config.options ?? {}) as TZaiOptions
    const extra: Record<string, unknown> = {}

    if (opts.thinking) {
      extra.thinking = {
        type: `enabled`,
        budget_tokens: opts.thinkingBudget ?? 2048,
      }
    }

    if (opts.doSample === false) {
      extra.do_sample = false
    }

    if (opts.toolStream) {
      extra.tool_stream = true
    }

    if (opts.webSearch) {
      extra.tools = [
        {
          type: `web_search`,
          web_search: { enable: true, ...opts.webSearch },
        },
      ]
    }

    return extra
  }

  protected mapFinishReason(reason: string): TStreamStopReason {
    switch (reason) {
      case `stop`:
        return `end_turn`
      case `tool_calls`:
        return `tool_use`
      case `length`:
        return `max_tokens`
      case `sensitive`:
        return `error`
      case `network_error`:
        return `error`
      default:
        return `end_turn`
    }
  }
}
