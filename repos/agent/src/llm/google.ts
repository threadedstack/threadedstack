import type { Type, FunctionDeclaration } from '@google/genai'
import type {
  ILLMAdapter,
  TAIMessage,
  TLLMToolDef,
  TStreamEvent,
  TLLMAdapterConfig,
} from '@tdsk/domain'

import { buildApiLogger } from '@tdsk/logger'
const logger = buildApiLogger(`google-adapter`)

type Content = { role: string; parts: Part[] }
type Part =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { result: string } } }

/**
 * Lazy-load @google/genai via dynamic import to avoid CJS/ESM issues.
 * The package depends on ESM-only modules (p-retry) that break in CJS bundles.
 */
const loadGoogleGenAI = async () => {
  const mod = await import(`@google/genai`)
  return mod.GoogleGenAI
}

/**
 * Convert unified messages to Google Gemini format
 * Filters out system messages (handled separately via systemInstruction)
 */
const toGoogleContents = (messages: TAIMessage[]): Content[] => {
  return messages
    .filter((m) => m.role !== `system`)
    .map((msg) => ({
      role: msg.role === `assistant` ? `model` : `user`,
      parts: msg.content.map((c): Part => {
        if (c.type === `text`) return { text: c.text }
        if (c.type === `tool_use`)
          return {
            functionCall: { name: c.name, args: c.input as Record<string, unknown> },
          }
        return {
          functionResponse: {
            name: c.toolUseId,
            response: { result: c.content },
          },
        }
      }),
    }))
}

/**
 * Convert unified tool defs to Google function declarations
 */
const toGoogleTools = (tools: TLLMToolDef[]): FunctionDeclaration[] => {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: `OBJECT` as Type.OBJECT,
      required: t.inputSchema.required,
      properties: t.inputSchema.properties as Record<string, unknown>,
    },
  }))
}

/**
 * Google Gemini LLM adapter using native @google/genai SDK
 * Streams via models.generateContentStream
 * Uses dynamic import() to avoid CJS/ESM compatibility issues
 */
export class GoogleAdapter implements ILLMAdapter {
  readonly provider = `google` as const

  async *stream(
    messages: TAIMessage[],
    tools: TLLMToolDef[],
    config: TLLMAdapterConfig
  ): AsyncIterable<TStreamEvent> {
    logger.info(`GoogleAdapter: loading SDK`)
    const GoogleGenAI = await loadGoogleGenAI()
    logger.info(`GoogleAdapter: SDK loaded, creating client`)
    const client = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: config.headers ? { headers: config.headers } : undefined,
    })

    const systemPrompt =
      config.systemPrompt ||
      messages
        .find((m) => m.role === `system`)
        ?.content.filter((c) => c.type === `text`)
        .map((c) => c.text)
        .join(`\n`)

    const contents = toGoogleContents(messages)
    const googleTools = tools.length > 0 ? toGoogleTools(tools) : undefined

    logger.info(
      `GoogleAdapter: calling generateContentStream model=${config.model} contents=${contents.length}`
    )
    const response = await client.models.generateContentStream({
      model: config.model,
      contents,
      config: {
        temperature: config.temperature,
        systemInstruction: systemPrompt,
        maxOutputTokens: config.maxTokens ?? 4096,
        tools: googleTools ? [{ functionDeclarations: googleTools }] : undefined,
      },
    })
    logger.info(`GoogleAdapter: stream started, iterating chunks`)

    let toolCallCounter = 0

    for await (const chunk of response) {
      if (!chunk.candidates?.[0]?.content?.parts) continue

      for (const part of chunk.candidates[0].content.parts) {
        if (part.text) {
          yield { type: `text` as const, text: part.text }
        }

        if (part.functionCall) {
          const toolId = `tool_${toolCallCounter++}`
          yield {
            id: toolId,
            type: `tool_call_start` as const,
            name: part.functionCall.name ?? ``,
          }
          yield {
            id: toolId,
            type: `tool_call_args` as const,
            args: JSON.stringify(part.functionCall.args ?? {}),
          }
        }
      }

      const finishReason = chunk.candidates?.[0]?.finishReason
      if (finishReason) {
        const stopReason =
          finishReason === `STOP`
            ? (`end_turn` as const)
            : finishReason === `MAX_TOKENS`
              ? (`max_tokens` as const)
              : (`end_turn` as const)

        yield { type: `done` as const, stopReason }
      }
    }
    logger.info(`GoogleAdapter: stream iteration complete`)
  }
}
