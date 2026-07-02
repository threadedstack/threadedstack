import type { TSession, TSessionPayload, TApp } from '@TBE/types'
import type { TAgentHandle, TAgentConfig, TAgentInitOpts } from '@tdsk/agent'
import type {
  TWSClientMsg,
  TStreamEvent,
  TWSServerMsg,
  TWSPromptMsg,
  TWSFileUploadMsg,
  TWSWorkspaceManifestMsg,
} from '@tdsk/domain'

import WS from 'ws'
import { AgentRunner } from '@tdsk/agent'
import { logger } from '@TBE/utils/logger'
import { EWSEventType, EStreamEventType } from '@tdsk/domain'
import { mimeFromPath } from '@TBE/utils/validation/mimeFromPath'
import { resolveAgentConfig } from '@TBE/utils/agent/resolveAgentConfig'
import { isAllowedMimeType } from '@TBE/utils/validation/isAllowedMimeType'
import { FileMaxSize, WsPingIntervalMS, ClientMsgTypes } from '@TBE/constants/values'
import { extractText, isImageMimeType } from '@TBE/services/files/fileExtractor'

type TWebsocketOpts = {
  app: TApp
  ws: WS
}

export class Websocket {
  #closed = false
  #ws: WS | undefined
  #pongReceived = true
  #app: TApp | undefined
  #runner: AgentRunner | null = null
  #agentHandle: TAgentHandle | null = null
  #workspace: Map<string, string> = new Map()
  #manifest: TWSWorkspaceManifestMsg | null = null
  pingInterval: NodeJS.Timeout | null = null
  abortController: AbortController | null = null
  #closedStates: number[] = [WebSocket.CLOSING, WebSocket.CLOSED]

  constructor(opts: TWebsocketOpts) {
    this.#ws = opts.ws
    this.#app = opts.app
  }

  async close() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
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

    this.#workspace.clear()
    this.#manifest = null

    if (!this.#closed) this.#ws?.close()

    this.#closed = true
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
    if (this.#ws?.readyState === WS.OPEN) {
      this.#ws.send(JSON.stringify(msg))
    } else if (this.#ws) {
      logger.warn(`WS send dropped (readyState=${this.#ws.readyState}), aborting agent`)
      this.abortController?.abort()
    }
  }

  /**
   * Build TAgentInitOpts from the pre-resolved session config.
   * Session includes sandboxConfig, skills, db, and
   * onExecuteFunction — all resolved by resolveAgentConfig().
   */
  async #buildInitOpts(session: TSession, threadId: string): Promise<TAgentInitOpts> {
    return {
      threadId,
      db: session.db,
      soul: session.soul,
      tools: session.tools,
      orgId: session.orgId,
      userId: session.userId,
      skills: session.skills,
      agentId: session.agentId,
      llmConfig: session.llmConfig,
      environment: session.environment,
      sandboxConfig: session.sandboxConfig,
      customFunctions: session.customFunctions,
      onExecuteFunction: session.onExecuteFunction,
      onEvent: (event: TStreamEvent) => {
        if (this.abortController?.signal.aborted) return
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
    const initOpts = await this.#buildInitOpts(session, threadId)
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
    if (this.abortController) {
      this.#sendError(`Agent is already running. Send cancel first.`)
      return
    }

    const ac = new AbortController()
    this.abortController = ac

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

        if (threadErr) {
          this.#sendError(`Failed to create thread: ${threadErr.message}`)
          return
        }
        if (!thread) {
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
      this.abortController = null
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
   * Handle a `file_upload` message — store the file in the session workspace
   * and persist it as an asset if a thread exists.
   */
  async handleFileUpload(
    msg: Omit<TWSFileUploadMsg, 'type'>,
    session: TSession,
    db: any
  ): Promise<void> {
    const { requestId, path, content } = msg
    if (!requestId || !path || typeof content !== `string`) {
      logger.warn(`[WS] file_upload missing required fields`, {
        requestId,
        path,
        hasContent: content != null,
      })
      this.send({
        type: EWSEventType.Error,
        message: `file_upload requires requestId, path, and content`,
      })
      return
    }

    if (path.includes(`..`) || path.startsWith(`/`)) {
      logger.warn(`[WS] file_upload rejected path traversal attempt`, { path })
      this.send({
        type: EWSEventType.Error,
        message: `Invalid file path: must be a relative path without ".." segments`,
      })
      return
    }

    const mimeType = mimeFromPath(path)
    if (!isAllowedMimeType(mimeType)) {
      logger.warn(`[WS] file_upload rejected disallowed MIME type`, { path, mimeType })
      this.send({
        type: EWSEventType.Error,
        message: `Unsupported file type: ${mimeType} (${path})`,
      })
      return
    }

    const fileSize = Buffer.byteLength(content, `utf8`)
    if (fileSize > FileMaxSize) {
      logger.warn(`[WS] file_upload rejected oversized file`, { path, fileSize })
      this.send({
        type: EWSEventType.Error,
        message: `File exceeds maximum size of 25MB`,
      })
      return
    }

    this.#workspace.set(path, content)

    const threadId = this.#runner?.threadId
    if (!threadId) {
      this.send({
        type: EWSEventType.FileUploadComplete,
        requestId,
        assetId: ``,
        fileName: path,
        fileType: mimeType,
        fileSize,
      })
      return
    }

    try {
      const buffer = Buffer.from(content, `utf8`)
      const extraction = await extractText(buffer, mimeType)

      const { data: asset, error } = await db.services.asset.create({
        name: path.split(`/`).pop() || path,
        type: mimeType,
        threadId,
        meta: {
          fileSize,
          extractedText: extraction.text,
          extractionError: extraction.error,
          isImage: isImageMimeType(mimeType),
        },
      })

      if (error || !asset) {
        logger.error(`[WS] Asset creation failed`, { path, threadId, error })
        this.send({
          type: EWSEventType.Error,
          message: `Failed to store file: ${error || `unknown error`}`,
        })
        return
      }

      this.send({
        type: EWSEventType.FileUploadComplete,
        requestId,
        assetId: asset.id,
        fileName: path,
        fileType: mimeType,
        fileSize,
      })
    } catch (err) {
      logger.error(`[WS] File upload processing failed`, {
        path,
        mimeType,
        error: err instanceof Error ? err.message : err,
      })
      this.send({
        type: EWSEventType.Error,
        message: `File processing failed: ${err instanceof Error ? err.message : `unknown error`}`,
      })
    }
  }

  /**
   * Handle a `workspace_manifest` message — store the client's file listing
   * so the server knows what files are available for request.
   */
  handleWorkspaceManifest(msg: Omit<TWSWorkspaceManifestMsg, 'type'>): void {
    if (!msg.rootDir || !Array.isArray(msg.files)) {
      this.send({
        type: EWSEventType.Error,
        message: `workspace_manifest requires rootDir and files array`,
      })
      return
    }

    const validFiles = msg.files.filter(
      (f): f is typeof f => f != null && typeof f.path === `string` && !!f.path
    )
    if (validFiles.length !== msg.files.length) {
      logger.warn(
        `[WS] Workspace manifest contained ${msg.files.length - validFiles.length} invalid entries, filtered out`
      )
    }

    this.#manifest = {
      type: EWSEventType.WorkspaceManifest,
      rootDir: msg.rootDir,
      files: validFiles,
    }
    logger.debug(
      `Workspace manifest received: ${validFiles.length} files from ${msg.rootDir}`
    )
  }

  getWorkspaceFile(path: string): string | undefined {
    return this.#workspace.get(path)
  }

  get workspaceManifest(): TWSWorkspaceManifestMsg | null {
    return this.#manifest
  }

  /**
   * Bridge TStreamEvent to EWSEventType WebSocket messages.
   * Maps TStreamEvent types to EWSEventType WebSocket messages for client consumption.
   */
  bridgeEventToWS(event: TStreamEvent): void {
    switch (event.type) {
      case EStreamEventType.text:
        this.send({ type: EWSEventType.TextDelta, delta: event.text })
        break
      case EStreamEventType.toolCallStart:
        this.send({
          args: {},
          toolCallId: event.id,
          toolName: event.name,
          type: EWSEventType.ToolExecutionStart,
        })
        break
      case EStreamEventType.toolResult:
        this.send({
          result: event.content,
          toolCallId: event.toolUseId,
          isError: event.isError ?? false,
          type: EWSEventType.ToolExecutionEnd,
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
              title: parsed.title,
              content: parsed.content,
              language: parsed.language,
              type: EWSEventType.Artifact,
              artifactType: parsed.artifactType,
            })
          }
        }
        break
      case EStreamEventType.toolExecutionUpdate:
        this.send({
          isError: false,
          result: event.content,
          toolCallId: event.toolUseId,
          type: EWSEventType.ToolExecutionUpdate,
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

  /**
   * Parse and validate an incoming WebSocket message.
   * Returns null for invalid/unrecognized payloads.
   */
  parseMsg = (raw: Buffer | string): TWSClientMsg | null => {
    try {
      const msg = JSON.parse(typeof raw === `string` ? raw : raw.toString(`utf8`))
      if (!msg || typeof msg.type !== `string` || !ClientMsgTypes.has(msg.type))
        return null
      return msg as TWSClientMsg
    } catch (err) {
      if (err instanceof SyntaxError) {
        logger.debug(`WS parse failed for message: ${String(raw).slice(0, 200)}`)
      } else {
        logger.warn(`WS unexpected parse error`, {
          error: err instanceof Error ? err.message : err,
        })
      }
      return null
    }
  }

  /**
   * Resolve the full session data from a verified token payload.
   * Uses the shared resolveAgentConfig() utility to load agent, secrets, and config.
   */
  resolveSession = async (
    payload: TSessionPayload
  ): Promise<{ session: TSession | null; error?: string }> => {
    try {
      const { db } = this.#app.locals

      const config = await resolveAgentConfig(payload.agentId, db, this.#app, {
        userId: payload.userId,
        projectId: payload.projectId,
      })

      const { agent, effectiveAgent, orgId, ...runtimeConfig } = config
      return {
        session: {
          orgId,
          agentId: agent.id,
          userId: payload.userId,
          projectId: payload.projectId,
          ...runtimeConfig,
        },
      }
    } catch (err) {
      logger.error(`Failed to resolve session`, {
        agentId: payload.agentId,
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
      })
      return {
        session: null,
        error: err instanceof Error ? err.message : `Agent session could not be resolved`,
      }
    }
  }

  /**
   * Send periodic heartbeats and detect dead connections.
   * Protocol-level ping/pong detects unresponsive clients (network failure, mobile sleep).
   * Application-level JSON ping keeps proxy/LB layers from killing idle connections during LLM processing.
   */
  keepalive = () => {
    this.#pongReceived = true
    this.#ws?.on(`pong`, () => {
      this.#pongReceived = true
    })

    this.pingInterval = setInterval(() => {
      if (!this.#ws || this.#ws.readyState !== WS.OPEN) {
        if (this.pingInterval) {
          clearInterval(this.pingInterval)
          this.pingInterval = null
        }
        return
      }

      if (!this.#pongReceived) {
        logger.warn(`[WS] Pong timeout — closing dead connection`)
        this.close()
        return
      }

      this.#pongReceived = false
      this.#ws.ping()
      this.#ws.send(JSON.stringify({ type: EWSEventType.Ping }))
    }, WsPingIntervalMS)

    return this.pingInterval
  }
}
