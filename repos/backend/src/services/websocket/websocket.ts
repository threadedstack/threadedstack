import type { TSession, TApp } from '@TBE/types'
import type { TStreamEvent, TWSServerMsg, TWSPromptMsg } from '@tdsk/domain'
import type {
  TAgentHandle,
  TAgentConfig,
  TAgentInitOpts,
  IAgentRunnerDB,
} from '@tdsk/agent'

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
  #closed = false
  #app: TApp | undefined
  #ws: WebSocket | undefined
  #runner: AgentRunner | null = null
  #agentHandle: TAgentHandle | null = null
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

  async close() {
    this.#closed = true
    if (this.#abortController) {
      this.#abortController.abort()
      this.send({ type: EWSEventType.Done, reason: `cancelled` })
    }
    if (this.#runner) {
      try {
        await this.#runner.destroy()
      } catch (e) {
        logger.error(`Failed to destroy AgentRunner: ${e}`)
      }
      this.#runner = null
    }
    this.#ws?.close()
    this.#ws = undefined
    this.#app = undefined
  }

  #sendError = (message: string): void => {
    this.send({ type: EWSEventType.Error, message })
    this.send({ type: EWSEventType.Done, reason: `error` })
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
      db.services.message.listByThread(opts.where.threadId, {
        limit: opts.limit,
        offset: opts.offset,
      }),
  })

  /**
   * Build the TAgentInitOpts from the session and DB.
   */
  async #buildInitOpts(
    session: TSession,
    db: any,
    threadId: string
  ): Promise<TAgentInitOpts> {
    const customFunctions = session.customFunctions || []
    const functionMap = new Map(customFunctions.map((fn: any) => [fn.id, fn]))

    const { data: skills } = await db.services.skill.listForAgent(session.agentId)

    const sandboxProvider = session.environment?.sandboxType || ESandboxType.local
    let podName = session.environment?.podName as string | undefined

    // Auto-start K8s pod if sandboxId is set but no explicit podName
    if (
      sandboxProvider === ESandboxType.kubernetes &&
      !podName &&
      session.environment?.sandboxId
    ) {
      const { config, sandbox } = (this.#app || ({ locals: {} } as TApp))?.locals
      if (!sandbox) throw new Error(`Sandbox service could not be loaded!`)

      podName = await sandbox.startPod({
        orgId: session.orgId,
        userId: session.userId,
        egressOpts: config.egress,
        projectId: session.projectId || ``,
        sandboxId: session.environment.sandboxId as string,
      })
    }

    if (sandboxProvider === ESandboxType.kubernetes && !podName) {
      throw new Error(`K8s sandbox not available — no podName or sandbox found`)
    }

    return {
      skills,
      threadId,
      customFunctions,
      tools: session.tools,
      orgId: session.orgId,
      userId: session.userId,
      agentId: session.agentId,
      db: this.createDBAdapter(db),
      llmConfig: session.llmConfig,
      environment: session.environment,
      sandboxConfig: {
        provider: sandboxProvider,
        envVars: session.envVars ?? {},
        timeout: session.environment?.timeout ?? 300000,
        options: podName ? { podName } : undefined,
      },
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
        if (this.#abortController?.signal.aborted) return
        this.bridgeEventToWS(event)
      },
    }
  }

  /**
   * Ensure a persistent AgentRunner is initialized for the given thread.
   * If the thread changes, the existing runner is destroyed and a new one created.
   */
  async #ensureRunner(session: TSession, db: any, threadId: string): Promise<void> {
    if (this.#runner && this.#runner.threadId === threadId) {
      return // Reuse existing runner for same thread
    }

    // Destroy old runner if thread changed
    if (this.#runner) {
      logger.info(
        `Thread changed from ${this.#runner.threadId} to ${threadId}, reinitializing runner`
      )
      await this.#runner.destroy()
      this.#runner = null
    }

    // Create and init new runner — hold in local var until init completes
    const runner = new AgentRunner()
    const initOpts = await this.#buildInitOpts(session, db, threadId)
    await runner.init(initOpts)

    // If close() was called during init, destroy the new runner and bail
    if (this.#closed) {
      await runner.destroy()
      return
    }

    this.#runner = runner
  }

  /**
   * Handle a `prompt` message — run a turn on the persistent agent
   * and stream events back over WebSocket.
   */
  async handlePrompt(
    msg: Omit<TWSPromptMsg, 'type'>,
    session: TSession,
    db: any
  ): Promise<void> {
    const { prompt, images, files } = msg
    if (!prompt) {
      this.#sendError(`prompt is required`)
      return
    }

    // Prevent concurrent runs on the same connection
    if (this.#abortController) {
      this.#sendError(`Agent is already running. Send cancel first.`)
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
          this.#sendError(`Failed to create thread`)
          return
        }

        threadId = thread.id
        this.send({ type: EWSEventType.ThreadCreated, threadId })
      }

      // 2. Ensure persistent runner is initialized for this thread
      await this.#ensureRunner(session, db, threadId)

      // If closed during init, notify client and bail
      if (this.#closed || !this.#runner) {
        this.send({ type: EWSEventType.Done, reason: `cancelled` })
        return
      }

      // 3. Run a turn on the persistent agent
      const handle = await this.#runner.runTurn({
        prompt,
        images,
        files,
        signal: ac.signal,
      })

      // Store handle for steer/followUp mid-run
      this.#agentHandle = handle

      // 4. Wait for agent to finish
      await handle.waitForIdle()

      // 5. Send done — WS uses typed JSON messages; SSE uses `[DONE]` sentinel.
      this.send({ type: EWSEventType.Done, reason: `complete` })
    } catch (err) {
      if (ac.signal.aborted) {
        this.send({ type: EWSEventType.Done, reason: `cancelled` })
      } else {
        this.#sendError(err instanceof Error ? err.message : `Agent execution failed`)
      }
    } finally {
      this.#agentHandle = null
      this.#abortController = null
    }
  }

  /**
   * Steer the running agent mid-execution.
   * Interrupts after current tool execution and redirects the agent.
   */
  handleSteer(message: string): void {
    if (!this.#agentHandle) {
      this.send({ type: EWSEventType.Error, message: `No agent running to steer` })
      return
    }
    this.#agentHandle.steer(message)
  }

  /**
   * Queue a follow-up message for the running agent.
   * Delivered after the agent finishes its current work.
   */
  handleFollowUp(message: string): void {
    if (!this.#agentHandle) {
      this.send({ type: EWSEventType.Error, message: `No agent running for follow-up` })
      return
    }
    this.#agentHandle.followUp(message)
  }

  /**
   * Update the persistent agent's runtime configuration.
   * Takes effect on the next turn.
   */
  handleUpdateConfig(config: TAgentConfig): void {
    if (!this.#runner?.initialized) {
      this.send({ type: EWSEventType.Error, message: `No agent session to update` })
      return
    }
    try {
      this.#runner.updateConfig(config)
    } catch (err) {
      const message = err instanceof Error ? err.message : `Config update failed`
      logger.error(`[WS] Config update error:`, err)
      this.send({ type: EWSEventType.Error, message })
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
        // Detect artifact content in tool results (from createArtifact tool)
        if (!event.isError && event.content) {
          let parsed: any
          try {
            parsed = JSON.parse(event.content)
          } catch {
            // Not JSON — skip artifact detection
            break
          }
          if (parsed?.artifactType && parsed?.content) {
            this.send({
              type: EWSEventType.Artifact,
              artifactType: parsed.artifactType,
              content: parsed.content,
              title: parsed.title,
              language: parsed.language,
            })
          }
        }
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
      case EStreamEventType.thinking:
        this.send({ type: EWSEventType.ThinkingDelta, delta: event.thinking })
        break
      case EStreamEventType.error:
        this.send({ type: EWSEventType.Error, message: event.error })
        break
      case EStreamEventType.turnEnd:
        this.send({ type: EWSEventType.TurnEnd, usage: event.usage })
        break
      case EStreamEventType.done:
        break
    }
  }
}
