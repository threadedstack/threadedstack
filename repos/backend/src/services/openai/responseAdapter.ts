import type { Response } from 'express'
import type { TStreamEvent, TTokenUsage } from '@tdsk/domain'
import type {
  TOAIResponse,
  TOAIChunk,
  TOAIUsage,
  TOAIErrorBody,
  TOAIFinishReason,
  TOAIErrorType,
} from '@TBE/types'

import { Exception } from '@tdsk/domain'
import { isStr } from '@keg-hub/jsutils/isStr'
import { EStreamEventType, EStreamStopReason } from '@tdsk/domain'

/**
 * Map ThreadedStack stop reason to OpenAI finish_reason.
 */
const mapStopReason = (reason: string): TOAIFinishReason => {
  switch (reason) {
    case EStreamStopReason.endTurn:
      return `stop`
    case EStreamStopReason.maxTokens:
      return `length`
    case EStreamStopReason.toolUse:
      return `tool_calls`
    default:
      return `stop`
  }
}

/**
 * Map ThreadedStack token usage to OpenAI usage format.
 */
const mapUsage = (usage: TTokenUsage): TOAIUsage => ({
  prompt_tokens: usage.input,
  completion_tokens: usage.output,
  total_tokens: usage.input + usage.output,
})

/**
 * Write a single OpenAI-formatted SSE chunk to the response.
 */
const writeChunk = (res: Response, chunk: TOAIChunk): void => {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
}

/**
 * Create a streaming response adapter.
 * Converts TStreamEvent to OpenAI chat.completion.chunk SSE format.
 */
export const createStreamingAdapter = (
  res: Response,
  completionId: string,
  model: string
) => {
  const created = Math.floor(Date.now() / 1000)

  const buildChunk = (
    delta: TOAIChunk[`choices`][0][`delta`],
    finishReason: TOAIFinishReason | null,
    usage?: TOAIUsage
  ): TOAIChunk => ({
    model,
    created,
    id: completionId,
    object: `chat.completion.chunk`,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
    ...(usage && { usage }),
  })

  return {
    /** Send the initial chunk with the assistant role. */
    sendInitial(): void {
      writeChunk(res, buildChunk({ role: `assistant` }, null))
    },

    /** Handle a TStreamEvent — emit OpenAI chunk or skip non-applicable events. */
    onEvent(event: TStreamEvent): void {
      switch (event.type) {
        case EStreamEventType.text:
          writeChunk(res, buildChunk({ content: event.text }, null))
          break
        case EStreamEventType.done:
          writeChunk(res, buildChunk({}, mapStopReason(event.stopReason)))
          break
        case EStreamEventType.turnEnd:
          writeChunk(res, buildChunk({}, null, mapUsage(event.usage)))
          break
        case EStreamEventType.error:
          res.write(
            `data: ${JSON.stringify({
              error: {
                code: null,
                param: null,
                message: event.error,
                type: `server_error`,
              },
            })}\n\n`
          )
          break
        // Events with no OpenAI equivalent — intentionally dropped.
        // This switch should remain exhaustive over EStreamEventType values.
        case EStreamEventType.thinking:
        case EStreamEventType.toolResult:
        case EStreamEventType.toolCallStart:
        case EStreamEventType.toolCallArgs:
        case EStreamEventType.toolExecutionUpdate:
          break
      }
    },

    /** Send the [DONE] sentinel and end the response. */
    finish(): void {
      res.write(`data: [DONE]\n\n`)
      res.end()
    },
  }
}

/**
 * Create a non-streaming response adapter.
 * Collects all TStreamEvents and builds a final chat.completion JSON response.
 */
export const createNonStreamingAdapter = (completionId: string, model: string) => {
  const textParts: string[] = []
  let finishReason: TOAIFinishReason = `stop`
  let usage: TOAIUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  let errorMessage: string | null = null

  return {
    onEvent(event: TStreamEvent): void {
      switch (event.type) {
        case EStreamEventType.text:
          textParts.push(event.text)
          break
        case EStreamEventType.done:
          finishReason = mapStopReason(event.stopReason)
          break
        case EStreamEventType.turnEnd:
          usage = mapUsage(event.usage)
          break
        case EStreamEventType.error:
          errorMessage = event.error
          break
      }
    },

    build(): TOAIResponse {
      if (errorMessage) {
        throw new Exception(500, errorMessage)
      }

      return {
        model,
        usage,
        id: completionId,
        object: `chat.completion`,
        created: Math.floor(Date.now() / 1000),
        choices: [
          {
            index: 0,
            finish_reason: finishReason,
            message: { role: `assistant`, content: textParts.join(``) || null },
          },
        ],
      }
    },
  }
}

/**
 * Map an Exception or Error to an OpenAI-formatted error response body.
 */
export const formatOAIError = (err: unknown): { status: number; body: TOAIErrorBody } => {
  const status = err instanceof Exception ? err.status : 500
  const message =
    err instanceof Error ? err.message : isStr(err) ? err : `Internal server error`

  let type: TOAIErrorType
  if (status === 401 || status === 403) type = `authentication_error`
  else if (status === 429) type = `rate_limit_error`
  else if (status >= 400 && status < 500) type = `invalid_request_error`
  else type = `server_error`

  return {
    status,
    body: {
      error: { message, type, param: null, code: null },
    },
  }
}
