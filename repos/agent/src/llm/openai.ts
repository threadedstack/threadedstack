import type { TLLMAdapterConfig } from '@tdsk/domain'
import { OpenAICompatibleAdapter } from './openai-compatible'

/**
 * OpenAI LLM adapter — extends OpenAICompatibleAdapter
 * Uses default Bearer auth, default finish reason mapping
 */
export class OpenAIAdapter extends OpenAICompatibleAdapter {
  readonly provider = `openai` as const

  protected getBaseUrl(_config: TLLMAdapterConfig): string {
    return `https://api.openai.com/v1`
  }
}
