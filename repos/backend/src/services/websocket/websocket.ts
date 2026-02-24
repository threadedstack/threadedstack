import type { TApp } from '@TBE/types'
import type { TStreamEvent, TWSServerMsg } from '@tdsk/domain'
import type { IAgentRunnerDB } from '@tdsk/agent'
import type { TSession } from '@TBE/types'

import WebSocket from 'ws'
import { logger } from '@TBE/utils/logger'
import { AgentRunner } from '@tdsk/agent'
import { EWSEventType, ESandboxType, EStreamEventType } from '@tdsk/domain'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'

type TWebsocketOpts = {
  app: TApp
  ws: WebSocket
}

export class Websocket {
  #app: TApp | undefined
  #ws: WebSocket | undefined
  #abortController: AbortController | null = null

  constructor(opts: TWebsocketOpts) {
    this.#ws = opts.ws
    this.#app = opts.app
  }

  get abortController(): AbortController | null {
    return this.#abortController
  }

  set abortController(ac: AbortController | null) {
    this.#abortController = ac
  }

  close() {
    this.#ws?.close()
    this.#ws = undefined
    this.#app = undefined
  }

  /**
   * Send a typed WS message.
   * If socket is no longer open, logs a warning and aborts the active agent run.
   */
  send = (msg: TWSServerMsg): void => {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(msg))
    } else if (this.#ws) {
      logger.warn(`WS send dropped (readyState=${this.#ws.readyState}), aborting agent`)
      this.#abortController?.abort()
    }
  }

  /**
   * Create an IAgentRunnerDB adapter from the app's database services
   */
  createDBAdapter = (db: any): IAgentRunnerDB => ({
    createMessage: (data) => db.services.message.create(data),
    listMessages: (opts) =>
      db.services.message.list({
        limit: opts.limit,
        where: opts.where,
        offset: opts.offset,
      }),
  })

  /**
   * Handle a `prompt` message — run the full agent loop server-side
   * and stream events back over WebSocket.
   */
  async handlePrompt(
    msg: { prompt: string; threadId?: string; maxSteps?: number },
    session: TSession,
    db: any
  ): Promise<void> {
    const { prompt, maxSteps } = msg
    if (!prompt) {
      this.send({ type: EWSEventType.Error, message: `prompt is required` })
      this.send({ type: EWSEventType.Done, reason: `error` })
      return
    }

    // Prevent concurrent runs on the same connection
    if (this.#abortController) {
      this.send({
        type: EWSEventType.Error,
        message: `Agent is already running. Send cancel first.`,
      })
      this.send({ type: EWSEventType.Done, reason: `error` })
      return
    }

    const ac = new AbortController()
    this.#abortController = ac

    try {
      // 1. Create or reuse thread
      let threadId = msg.threadId
      if (!threadId) {
        const { data: thread, error: threadErr } = await db.services.thread.create({
          orgId: session.orgId,
          userId: session.userId,
          agentId: session.agentId,
          name: prompt.substring(0, 100),
        })

        if (threadErr || !thread) {
          this.send({ type: EWSEventType.Error, message: `Failed to create thread` })
          this.send({ type: EWSEventType.Done, reason: `error` })
          return
        }

        threadId = thread.id
        this.send({ type: EWSEventType.ThreadCreated, threadId })
      }

      // 2. Build sandbox config from session (envVars stay server-side)
      const sandboxConfig = {
        provider: ESandboxType.local,
        envVars: session.envVars ?? {},
        timeout: session.environment?.timeout ?? 300000,
      }

      // 3. Build function map for custom function execution
      const customFunctions = session.customFunctions || []
      const functionMap = new Map(customFunctions.map((fn: any) => [fn.id, fn]))

      // 4. Run the agent — events stream back over WS
      await AgentRunner.run({
        prompt,
        threadId,
        sandboxConfig,
        signal: ac.signal,
        tools: session.tools,
        orgId: session.orgId,
        userId: session.userId,
        agentId: session.agentId,
        db: this.createDBAdapter(db),
        llmConfig: session.llmConfig,
        environment: session.environment,
        customFunctions,
        maxSteps,
        onExecuteFunction: async (functionId, input) => {
          const func = functionMap.get(functionId)
          if (!func) {
            return {
              duration: 0,
              output: null,
              success: false,
              error: `Function not found`,
            }
          }
          return FunctionExecutor.execute(func, {
            context: { args: input as Record<string, any> },
          })
        },
        onEvent: (event: TStreamEvent) => {
          if (ac.signal.aborted) return
          this.bridgeEventToWS(event)
        },
      })

      // 5. Send done
      this.send({ type: EWSEventType.Done, reason: `complete` })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Agent execution failed`
      if (!ac.signal.aborted) {
        this.send({ type: EWSEventType.Error, message })
        this.send({ type: EWSEventType.Done, reason: `error` })
      }
    } finally {
      this.#abortController = null
    }
  }

  /**
   * Bridge TStreamEvent to EWSEventType WebSocket messages.
   * Maps the existing event types to the new WS protocol.
   */
  bridgeEventToWS(event: TStreamEvent): void {
    switch (event.type) {
      case EStreamEventType.text:
        this.send({ type: EWSEventType.TextDelta, delta: event.text })
        break
      case EStreamEventType.toolCallStart:
        this.send({
          type: EWSEventType.ToolExecutionStart,
          toolCallId: event.id,
          toolName: event.name,
          args: {},
        })
        break
      case EStreamEventType.toolResult:
        this.send({
          type: EWSEventType.ToolExecutionEnd,
          toolCallId: event.toolUseId,
          result: event.content,
          isError: event.isError ?? false,
        })
        break
      case EStreamEventType.toolExecutionUpdate:
        this.send({
          type: EWSEventType.ToolExecutionUpdate,
          toolCallId: event.toolUseId,
          result: event.content,
          isError: false,
        })
        break
      case EStreamEventType.toolCallArgs:
        // toolCallArgs events contain incremental JSON deltas for tool arguments.
        // The WS protocol has no equivalent message type — args are not forwarded.
        // ToolExecutionStart sends args: {} since args aren't available at start time.
        break
      case EStreamEventType.error:
        this.send({ type: EWSEventType.Error, message: event.error })
        break
      case EStreamEventType.done:
        // TODO: Wire actual token usage from pi-mono (currently hardcoded to zero)
        this.send({ type: EWSEventType.TurnEnd, usage: { input: 0, output: 0 } })
        break
    }
  }
}
