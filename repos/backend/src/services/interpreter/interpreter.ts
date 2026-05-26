import { getModel, streamSimple } from '@earendil-works/pi-ai'
import type { TGuiConfig, TParsedEvent, TGenerativeUIResult } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { validateTree } from './validator'
import { getSystemPrompt, buildUserMessage } from './prompt'

export class InterpreterService {
  async interpret(
    chunk: { chunkId: string; events: TParsedEvent[] },
    config: TGuiConfig,
    providerBrand: string,
    apiKey: string
  ): Promise<TGenerativeUIResult | null> {
    const userMessage = buildUserMessage(chunk.events)
    if (!userMessage.trim()) return null

    // Validate model exists before retry loop — won't change between retries
    const model = getModel(providerBrand as any, config.model as any)
    if (!model) {
      logger.error('[InterpreterService] Model not found', {
        providerBrand,
        model: config.model,
        chunkId: chunk.chunkId,
      })
      return null
    }

    const systemPrompt = getSystemPrompt(config)
    let lastError: Error | null = null
    const maxAttempts = 1 + config.maxRetries

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const text = await this.#callLLM(model, apiKey, systemPrompt, userMessage)
        return this.#parseResponse(text)
      } catch (err) {
        lastError = err as Error
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        }
      }
    }

    logger.error('[InterpreterService] Failed after retries', {
      attempts: maxAttempts,
      chunkId: chunk.chunkId,
      model: config.model,
      providerBrand,
      error: lastError?.message,
    })
    return null
  }

  async #callLLM(
    model: any,
    apiKey: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<string> {
    const stream = await streamSimple(
      model,
      {
        systemPrompt,
        messages: [
          { role: 'user' as const, content: userMessage, timestamp: Date.now() },
        ],
      },
      { maxTokens: 2048, temperature: 0, apiKey }
    )

    let response = ''
    for await (const event of stream) {
      if (event.type === 'text_delta') response += event.delta
      if (event.type === 'error')
        throw new Error(String((event as any).error ?? 'Unknown error'))
    }

    return response
  }

  #parseResponse(text: string): TGenerativeUIResult | null {
    const cleaned = text.replace(/```json\s*|```\s*/g, '').trim()

    if (cleaned === 'null') return null

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch (err) {
      throw new Error(
        `JSON parse failed: ${(err as Error).message}. Response preview: ${text.slice(0, 200)}`
      )
    }

    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
      throw new Error(
        `Response missing required type field. Response preview: ${text.slice(0, 200)}`
      )
    }

    if (!validateTree(parsed)) {
      throw new Error(
        `Response failed tree validation. Response preview: ${text.slice(0, 200)}`
      )
    }

    return { tree: parsed as TGenerativeUIResult['tree'] }
  }
}
