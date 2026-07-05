import type {
  ISandbox,
  TMessageContent,
  TStreamEvent,
  TLLMAdapterConfig,
} from '@tdsk/domain'
import type { AgentEvent, AgentMessage, StreamFn } from '@earendil-works/pi-agent-core'
import type {
  TAgentHandle,
  TAgentConfig,
  TAgentRunOpts,
  TAgentInitOpts,
  TAgentTurnOpts,
} from '@TAG/types'
import type {
  Api,
  Model,
  Message,
  ImageContent,
  AssistantMessage,
  ToolResultMessage,
} from '@earendil-works/pi-ai'

import { logger } from '@TAG/utils/logger'
import { Agent } from '@earendil-works/pi-agent-core'
import { createSandboxProvider } from '@tdsk/sandbox'
import { mapAgentEvent } from '@TAG/adapters/eventBridge'
import { isTransientError } from '@TAG/utils/errorClassifier'
import { resolveActiveSkills } from '@TAG/utils/skillResolver'
import { createContextManager } from '@TAG/utils/contextManager'
import { createWebProvider } from '@TAG/tools/definitions/web/webProvider'
import { EContentType, EMemoryKind, buildFallbackModel } from '@tdsk/domain'
import { getModel, streamSimple, isContextOverflow } from '@earendil-works/pi-ai'
import {
  createWebTools,
  createTaskTools,
  createSkillTools,
  createMemoryTools,
  createSandboxTools,
  createDelegateTools,
  createEscalateTools,
  buildCustomFunctionTools,
} from '@TAG/tools/tools'
import {
  convertToLlmMessages,
  convertAssistantToContent,
  convertToolResultToContent,
} from '@TAG/adapters/messageConverter'

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Shape of a thread message as returned by IAgentRunnerDB.listMessages */
type TThreadMessage = {
  type: string
  content: TMessageContent[]
  createdAt?: string | Date
}

/** True when the content array carries at least one meaningful part */
const hasMeaningfulParts = (content?: TMessageContent[]): boolean =>
  Boolean(
    content?.some(
      (part: any) =>
        (part?.type === EContentType.text &&
          typeof part.text === `string` &&
          part.text.trim().length > 0) ||
        (part?.type === EContentType.thinking &&
          typeof part.thinking === `string` &&
          part.thinking.trim().length > 0) ||
        part?.type === EContentType.toolUse
    )
  )

/** True when the content array contains a toolUse part */
const hasToolUseParts = (content?: TMessageContent[]): boolean =>
  Boolean(content?.some((part: any) => part?.type === EContentType.toolUse))

/**
 * Detect pi-agent's LLM-failure signature on an assistant message.
 *
 * Evidence (pi-agent-core 0.75.5):
 * - `Agent.handleRunFailure()` (dist/agent.js): a thrown stream error is
 *   converted into an assistant message with content `[{ type: 'text',
 *   text: '' }]`, zero usage, `stopReason: 'error' | 'aborted'`, and
 *   `errorMessage` set — emitted via message_start/message_end/turn_end/
 *   agent_end, never thrown to the caller.
 * - `runLoop()` (dist/agent-loop.js): an in-stream API error resolves the
 *   turn with an assistant message carrying `stopReason: 'error'` +
 *   `errorMessage`, then emits turn_end/agent_end and returns normally.
 * Both paths surface failure ONLY on the message, so detection keys on
 * stopReason/errorMessage first, with empty-content+zero-usage as a backstop
 * for adapters that mark neither.
 */
const isFailedAssistantMessage = (msg: AssistantMessage): boolean => {
  if (msg.stopReason === `error` || msg.stopReason === `aborted`) return true
  if (msg.errorMessage) return true

  const hasContent = msg.content?.some(
    (part: any) =>
      (part?.type === `text` &&
        typeof part.text === `string` &&
        part.text.trim().length > 0) ||
      (part?.type === `thinking` &&
        typeof part.thinking === `string` &&
        part.thinking.trim().length > 0) ||
      part?.type === `toolCall`
  )

  return !hasContent && (msg.usage?.output ?? 0) === 0
}

/**
 * Sanitize thread history in-memory before handing it to pi (never mutates the DB).
 *
 * Contract evidence (pi-agent-core 0.75.5):
 * - `Agent.prompt()` accepts ANY history tail — it appends the new user message
 *   before running the loop — so a VALID trailing assistant message is KEPT.
 * - `Agent.continue()` / `runAgentLoopContinue()` (dist/agent.js:244,
 *   dist/agent-loop.js:61) throw `Cannot continue from message role: assistant`
 *   when the transcript tail is an assistant message; this is the error a
 *   poisoned tail produces on the runner's transient-retry/failover path.
 * - Empty assistant messages (pi's persisted failure signature: a single empty
 *   text part) are rejected by providers anywhere in the transcript, so they
 *   are dropped wherever they appear, without reordering survivors.
 * - A TRAILING assistant message containing toolUse parts is dangling — its
 *   toolResult replies were never persisted, providers reject an unanswered
 *   tool_use, and pi has no repair step (`convertToLlm` only filters roles).
 */
const sanitizeThreadMessages = (
  messages: TThreadMessage[]
): { messages: TThreadMessage[]; dropped: number } => {
  // Drop empty assistant messages anywhere (interior + tail), preserving order
  const filtered = messages.filter(
    (msg) => msg.type !== `assistant` || hasMeaningfulParts(msg.content)
  )

  // Drop dangling assistant tails (toolUse with no persisted toolResults)
  let end = filtered.length
  while (
    end > 0 &&
    filtered[end - 1].type === `assistant` &&
    hasToolUseParts(filtered[end - 1].content)
  ) {
    end--
  }

  const result = end < filtered.length ? filtered.slice(0, end) : filtered
  return { messages: result, dropped: messages.length - result.length }
}

/**
 * AgentRunner - Persistent agent session using pi-mono's Agent class.
 *
 * Instance lifecycle:
 *   init()        → creates sandbox, tools, loads history, creates Agent
 *   runTurn()     → prompts existing Agent, saves messages, returns handle
 *   updateConfig() → mutates Agent model/tools/systemPrompt at runtime
 *   destroy()     → cleans up sandbox and subscriptions
 *
 * Static convenience:
 *   AgentRunner.run(opts) → one-shot init+runTurn+auto-destroy (for SSE endpoint)
 */
export class AgentRunner {
  #agent: Agent | null = null
  #baseSystemPrompt: string = ``
  #soul: string = ``
  #sandbox: ISandbox | undefined
  #threadId: string | null = null
  #model: Model<Api> | null = null
  #streamFn: StreamFn | null = null
  #opts: TAgentInitOpts | null = null
  #activeLlmConfig: TLLMAdapterConfig | null = null
  #unsubscribe: (() => void) | undefined
  #pendingPersistence: Promise<any>[] = []

  #composeSystemPrompt(base: string): string {
    return [this.#soul, base].filter(Boolean).join(`\n\n`)
  }

  /** The threadId this runner was initialized for */
  get threadId(): string | null {
    return this.#threadId
  }

  /** Whether this runner has been initialized */
  get initialized(): boolean {
    return this.#agent !== null
  }

  /**
   * Initialize the runner — creates sandbox, tools, loads history, creates Agent.
   * Must be called before runTurn().
   */
  async init(opts: TAgentInitOpts): Promise<void> {
    if (this.#agent) {
      throw new Error(`AgentRunner already initialized. Call destroy() first.`)
    }

    this.#opts = opts
    this.#threadId = opts.threadId
    const { db, threadId, llmConfig, sandboxConfig, onEvent } = opts

    // 1. Load conversation history
    const { data: existingMessages } = await db.listMessages({
      where: { threadId },
      limit: 100,
      offset: 0,
    })

    // 1b. Sanitize the in-memory history so a poisoned tail (empty assistant
    // failure messages, dangling toolUse tails) can never break future turns.
    // The DB is never mutated — only the copy handed to the Agent.
    const { messages: sanitizedMessages, dropped } = sanitizeThreadMessages(
      existingMessages || []
    )
    if (dropped > 0) {
      logger.warn(
        `Thread ${threadId} history sanitized: dropped ${dropped} message(s) (empty assistant messages and/or dangling assistant tail)`
      )
    }

    // 2. Create sandbox + tools if configured
    if (sandboxConfig?.provider) {
      const provider = createSandboxProvider(sandboxConfig.provider as any)

      this.#sandbox = await provider.create({
        envVars: sandboxConfig.envVars,
        options: sandboxConfig.options || {},
        provider: sandboxConfig.provider as any,
        timeout: sandboxConfig.timeout ?? 300000,
      })
    }
    const wpApiKey = opts.environment?.webProvider?.apiKey
    if (opts.environment?.webProvider?.secretId && !wpApiKey) {
      logger.warn(`Web provider configured with secretId but no API key was resolved`, {
        agentId: opts.agentId,
        orgId: opts.orgId,
        secretId: opts.environment.webProvider.secretId,
        webProviderType: opts.environment.webProvider.type,
      })
    }
    const agentTools = this.#buildTools(opts.tools)

    // 3. Create pi-mono model
    // getModel returns Model<specific Api> but we store as Model<Api> for multi-provider support
    this.#activeLlmConfig = llmConfig
    this.#model =
      ((getModel(llmConfig.provider as any, llmConfig.model as any) ??
        buildFallbackModel(llmConfig)) as Model<Api> | undefined) ?? null

    if (!this.#model)
      throw new Error(
        `Unknown model "${llmConfig.model}" for provider "${llmConfig.provider}"`
      )

    // 4. Convert history to pi-mono messages (using current model's api/provider for AssistantMessage reconstruction)
    const history = convertToLlmMessages(sanitizedMessages, {
      api: this.#model.api,
      provider: this.#model.provider,
      model: this.#model.id,
    })

    // 5. Build streamFn wrapper to inject temperature, maxTokens, headers,
    // cacheRetention. Reads the ACTIVE llm config so provider failover can
    // hot-swap credentials/params mid-turn.
    this.#streamFn = (streamModel, context, streamOpts) => {
      const active = this.#activeLlmConfig ?? llmConfig
      return streamSimple(streamModel, context, {
        ...streamOpts,
        temperature: active.temperature,
        maxTokens: active.maxTokens,
        headers: active.headers,
        cacheRetention: opts.environment?.cacheRetention,
      })
    }

    // 6. Build context manager for automatic context window management
    const budgetPercent = opts.environment?.contextBudgetPercent ?? 80
    const compaction = opts.environment?.contextCompaction
    const memoryProvider = opts.memoryProvider
    const transformContext = createContextManager(
      this.#model,
      budgetPercent,
      compaction?.enabled
        ? {
            strategy: compaction.strategy,
            streamFn: this.#streamFn,
            compactionModel: compaction.compactionModel,
            // Persist the otherwise-discarded compaction summary as a durable
            // memory when a provider is configured. Errors are swallowed so
            // memory persistence can never break a turn.
            onSummary: memoryProvider
              ? (summary: string) => {
                  void memoryProvider
                    .write({
                      text: summary,
                      importance: 5,
                      kind: EMemoryKind.compaction,
                    })
                    .catch((err) => {
                      logger.warn(`Failed to persist compaction memory: ${err}`)
                    })
                }
              : undefined,
          }
        : undefined
    )

    // 7. Build pi-mono Agent with convertToLlm filter
    const thinkingLevel = opts.environment?.thinkingLevel
    this.#soul = opts.soul || ``
    const composedSystemPrompt = this.#composeSystemPrompt(llmConfig.systemPrompt || ``)
    const hasApiKey = Boolean(
      llmConfig.apiKey || opts.llmConfigs?.some((config) => config.apiKey)
    )
    this.#agent = new Agent({
      streamFn: this.#streamFn,
      sessionId: threadId,
      transformContext,
      convertToLlm: filterCustomMessages,
      getApiKey: hasApiKey ? () => this.#activeLlmConfig?.apiKey : undefined,
      thinkingBudgets: opts.environment?.thinkingBudgets,
      initialState: {
        model: this.#model,
        tools: agentTools,
        messages: history as Message[],
        systemPrompt: composedSystemPrompt,
        ...(thinkingLevel && thinkingLevel !== `off` ? { thinkingLevel } : {}),
      },
    })

    // 7b. Store the base system prompt (soul + base) for per-turn skill resolution
    this.#baseSystemPrompt = composedSystemPrompt

    // 8. Subscribe to events — bridge to TStreamEvent + persist messages
    this.#unsubscribe = this.#agent.subscribe((event: AgentEvent) => {
      const streamEvent = mapAgentEvent(event, this.#model)
      if (streamEvent) onEvent(streamEvent)

      // Queue message persistence on turn_end (drained after agent completes)
      if (event.type === `turn_end`) {
        const assistantMsg = event.message as AssistantMessage
        if (assistantMsg?.role === `assistant`) {
          // A failed/aborted turn produces pi's empty failure message — never
          // persist it, or the thread tail poisons every subsequent run
          if (isFailedAssistantMessage(assistantMsg)) {
            logger.warn(
              `Skipping persistence of failed assistant message on thread ${threadId}: ${
                assistantMsg.errorMessage ||
                `${assistantMsg.stopReason || `empty`} response with zero usage`
              }`
            )
          } else {
            const content = convertAssistantToContent(assistantMsg)
            this.#pendingPersistence.push(
              db.createMessage({
                content,
                threadId,
                type: `assistant`,
                orgId: opts.orgId,
              })
            )
          }
        }

        for (const tr of event.toolResults) {
          const toolContent = convertToolResultToContent(tr as ToolResultMessage)
          this.#pendingPersistence.push(
            db.createMessage({
              threadId,
              type: `user`,
              orgId: opts.orgId,
              content: [toolContent],
            })
          )
        }
      }
    })
  }

  /**
   * Run a single turn — saves user message, prompts the agent, returns handle.
   * The agent reuses its in-memory history from previous turns.
   */
  async runTurn(opts: TAgentTurnOpts): Promise<TAgentHandle> {
    if (!this.#agent || !this.#opts) {
      throw new Error(`AgentRunner not initialized. Call init() first.`)
    }

    const { prompt, images, files, signal } = opts
    const initOpts = this.#opts

    // 0. Resolve active skills for this turn's prompt and update system prompt + tools
    if (initOpts.skills?.length) {
      const resolved = resolveActiveSkills(initOpts.skills, prompt)
      const updatedPrompt = this.#baseSystemPrompt + resolved.instructions
      this.#agent!.state.systemPrompt = updatedPrompt

      if (resolved.tools.length > 0) {
        const mergedToolNames = [
          ...new Set([...(initOpts.tools || []), ...resolved.tools]),
        ]
        this.#agent!.state.tools = this.#buildTools(mergedToolNames)
      }
    }

    // 1. Wire abort signal for this turn
    let abortHandler: (() => void) | undefined
    if (signal) {
      abortHandler = () => this.#agent!.abort()
      signal.addEventListener(`abort`, abortHandler, { once: true })
    }

    // 2. Save user message to DB (include image/file references if present)
    const userContent: TMessageContent[] = [
      { type: EContentType.text as const, text: prompt },
    ]
    if (images?.length) {
      for (const img of images) {
        userContent.push({
          type: EContentType.image as const,
          data: img.data,
          mimeType: img.mimeType,
        })
      }
    }
    if (files?.length) {
      for (const file of files) {
        userContent.push({
          type: EContentType.file as const,
          assetId: file.assetId,
          fileName: file.fileName,
          fileType: file.mimeType,
          fileSize: 0,
          extractedText: file.extractedText,
        })
      }
    }
    await initOpts.db.createMessage({
      threadId: this.#threadId!,
      type: `user`,
      orgId: initOpts.orgId,
      content: userContent,
    })

    // 3. Build image contents for pi-mono (from direct images + file image data)
    let imageContents: ImageContent[] | undefined = images?.map((img) => ({
      type: `image` as const,
      data: img.data,
      mimeType: img.mimeType,
    }))
    if (files?.length) {
      for (const file of files) {
        if (file.imageData) {
          imageContents ??= []
          imageContents.push({
            type: `image` as const,
            data: file.imageData,
            mimeType: file.mimeType,
          })
        }
      }
    }

    // 4. Build full prompt with file context prepended
    let fullPrompt = prompt
    if (files?.length) {
      const fileContext = files
        .filter((f) => f.extractedText)
        .map(
          (f) =>
            `[Attached file: ${f.fileName}]\n<extracted_content>\n${f.extractedText}\n</extracted_content>`
        )
        .join(`\n\n`)
      if (fileContext) fullPrompt = `${fileContext}\n\n${prompt}`
    }

    // Track last assistant message for overflow detection
    let lastAssistantMsg: AssistantMessage | undefined
    const turnListener = this.#agent.subscribe((event: AgentEvent) => {
      if (event.type === `turn_end`) {
        const msg = event.message as AssistantMessage
        if (msg?.role === `assistant`) lastAssistantMsg = msg
      }
    })

    const cleanup = () => {
      turnListener()
      if (abortHandler && signal) {
        signal.removeEventListener(`abort`, abortHandler)
      }
    }

    // 5. Start the agent loop (non-blocking)
    const agent = this.#agent

    /**
     * Remove trailing failure assistant messages from the in-memory transcript.
     * pi's continue() throws `Cannot continue from message role: assistant`
     * on an assistant tail, and providers reject empty assistant content —
     * stripping the failure tail makes the transcript a valid continuation
     * point (tail = the user prompt or a toolResult) for retry/failover.
     */
    const stripFailedTail = () => {
      const messages = agent.state.messages
      if (!messages?.length) return
      let end = messages.length
      while (end > 0) {
        const msg = messages[end - 1] as AssistantMessage
        if (msg?.role !== `assistant` || !isFailedAssistantMessage(msg)) break
        end--
      }
      if (end < messages.length) agent.state.messages = messages.slice(0, end)
    }

    /**
     * Detect an LLM failure for the just-finished attempt.
     * Returns the failure message, or undefined on success/abort.
     * Aborts (user-initiated) are never treated as LLM failures.
     */
    const detectLlmFailure = (): string | undefined => {
      if (signal?.aborted) return undefined
      if (lastAssistantMsg?.stopReason === `aborted`) return undefined
      if (agent.state.errorMessage) return agent.state.errorMessage
      return lastAssistantMsg && isFailedAssistantMessage(lastAssistantMsg)
        ? lastAssistantMsg.errorMessage ||
            `LLM returned an empty response (no content, zero usage)`
        : undefined
    }

    let runPromise: Promise<void>
    try {
      runPromise = (async () => {
        try {
          await agent.prompt(fullPrompt, imageContents)
          await agent.waitForIdle()

          // Retry loop for transient failures on the active provider
          const maxRetries = initOpts.environment?.maxRetries ?? 2
          let retries = 0
          while (retries < maxRetries && agent.state.errorMessage && !signal?.aborted) {
            const errorStr = agent.state.errorMessage
            if (!isTransientError(errorStr)) break
            retries++
            logger.warn(
              `Transient error, retrying (${retries}/${maxRetries}): ${errorStr}`
            )
            await delay(1000 * retries)
            stripFailedTail()
            await agent.continue()
            await agent.waitForIdle()
          }

          // Provider failover: retry the SAME turn once per remaining config
          // in the priority-ordered chain (llmConfigs[0] is the active config)
          let failure = detectLlmFailure()
          if (failure && initOpts.llmConfigs && initOpts.llmConfigs.length > 1) {
            const chain = initOpts.llmConfigs
            for (let idx = 1; idx < chain.length && failure && !signal?.aborted; idx++) {
              const next = chain[idx]
              const nextModel =
                ((getModel(next.provider as any, next.model as any) ??
                  buildFallbackModel(next)) as Model<Api> | undefined) ?? null
              if (!nextModel) {
                logger.warn(
                  `Failover skipped: unknown model "${next.model}" for provider "${next.provider}"`
                )
                continue
              }

              logger.warn(
                `LLM failure on provider "${this.#activeLlmConfig?.provider}" — failing over to "${next.provider}/${next.model}" (${idx + 1}/${chain.length}): ${failure}`
              )
              this.#activeLlmConfig = next
              this.#model = nextModel
              agent.state.model = nextModel
              stripFailedTail()
              await agent.continue()
              await agent.waitForIdle()
              failure = detectLlmFailure()
            }
          }

          // Surface the failure: strip the poisoned tail from in-memory state
          // and reject so callers record an error run, not a silent empty turn
          if (failure) {
            stripFailedTail()
            throw new Error(failure)
          }

          // Check for context overflow after agent completes
          const model = this.#model!
          if (
            lastAssistantMsg &&
            isContextOverflow(lastAssistantMsg, model.contextWindow)
          ) {
            logger.warn(
              `Context overflow detected for model ${model.id} (${model.contextWindow} tokens)`
            )
            initOpts.onEvent({
              type: `error`,
              error: `Context window exceeded. The conversation is too long for this model.`,
            } as TStreamEvent)
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown agent error`
          logger.error(`AgentRunner error: ${message}`)
          initOpts.onEvent({ type: `error`, error: message } as TStreamEvent)
          throw err instanceof Error ? err : new Error(message)
        } finally {
          await this.#drainPersistence()
          cleanup()
        }
      })()
      // Callers may drop the handle without awaiting waitForIdle — mark the
      // rejection handled so a surfaced LLM failure never crashes the process.
      // waitForIdle() still returns the original (rejecting) promise.
      runPromise.catch(() => {})
    } catch (err) {
      cleanup()
      throw err
    }

    // 6. Return handle for caller to steer/follow-up/await
    return {
      steer: (message: string) => {
        agent.steer({ role: `user`, content: message, timestamp: Date.now() })
      },
      followUp: (message: string) => {
        agent.followUp({ role: `user`, content: message, timestamp: Date.now() })
      },
      abort: () => agent.abort(),
      waitForIdle: () => runPromise,
    }
  }

  /**
   * Update agent configuration at runtime (between turns).
   * Resolves model from pi-mono registry if model/provider are provided.
   */
  updateConfig(config: TAgentConfig): void {
    if (!this.#agent) {
      throw new Error(`AgentRunner not initialized. Call init() first.`)
    }

    if (config.model && config.provider) {
      const newModel = (getModel(config.provider as any, config.model as any) ??
        buildFallbackModel({
          ...this.#opts!.llmConfig,
          model: config.model,
          provider: config.provider as any,
        })) as Model<Api> | undefined
      if (newModel) {
        this.#model = newModel
        this.#agent.state.model = newModel
        this.#activeLlmConfig = {
          ...(this.#activeLlmConfig ?? this.#opts!.llmConfig),
          model: config.model,
          provider: config.provider as any,
        }
      }
    }

    if (config.systemPrompt !== undefined) {
      this.#baseSystemPrompt = this.#composeSystemPrompt(config.systemPrompt)
      this.#agent.state.systemPrompt = this.#baseSystemPrompt
    }

    if (config.thinkingLevel) {
      this.#agent.state.thinkingLevel = config.thinkingLevel as any
    }

    if (config.tools) {
      this.#agent.state.tools = this.#buildTools(config.tools, false)
    }
  }

  /**
   * Build sandbox + web + optional custom function tools for the current config.
   */
  #buildTools(toolNames?: string[], includeCustom = true) {
    const webProvider = createWebProvider(this.#opts?.environment?.webProvider)
    const sandboxTools = this.#sandbox ? createSandboxTools(this.#sandbox, toolNames) : []
    const webTools = createWebTools(webProvider, toolNames)
    const memoryTools = this.#opts?.memoryProvider
      ? createMemoryTools(this.#opts.memoryProvider, toolNames)
      : []
    const skillTools = this.#opts?.skillProvider
      ? createSkillTools(this.#opts.skillProvider, toolNames)
      : []
    const taskTools = this.#opts?.taskProvider
      ? createTaskTools(this.#opts.taskProvider, toolNames)
      : []
    const escalateTools = this.#opts?.escalationProvider
      ? createEscalateTools(this.#opts.escalationProvider, toolNames)
      : []
    const delegateTools = this.#opts?.delegateProvider
      ? createDelegateTools(this.#opts.delegateProvider, toolNames, {
          delegationDepth: this.#opts.delegationDepth,
          maxDelegationDepth: this.#opts.maxDelegationDepth,
        })
      : []
    const tools = [
      ...sandboxTools,
      ...webTools,
      ...memoryTools,
      ...skillTools,
      ...taskTools,
      ...escalateTools,
      ...delegateTools,
    ]

    if (
      includeCustom &&
      this.#opts?.customFunctions?.length &&
      this.#opts.onExecuteFunction
    ) {
      tools.push(
        ...buildCustomFunctionTools(
          this.#opts.customFunctions,
          this.#opts.onExecuteFunction
        )
      )
    }

    return tools
  }

  /**
   * Await all queued message persistence promises and log any failures.
   */
  async #drainPersistence(): Promise<void> {
    const pending = this.#pendingPersistence.splice(0)
    if (!pending.length) return
    const results = await Promise.allSettled(pending)
    for (const r of results) {
      if (r.status === `rejected`) {
        logger.error(`Failed to persist message: ${r.reason}`)
      }
    }
  }

  /**
   * Destroy the runner — cleans up sandbox, subscriptions, and agent.
   * After destroy, init() can be called again for a new session.
   */
  async destroy(): Promise<void> {
    this.#unsubscribe?.()
    this.#unsubscribe = undefined
    await this.#drainPersistence()

    if (this.#sandbox) {
      try {
        await this.#sandbox.close()
      } catch (e) {
        logger.error(`Failed to close sandbox: ${e}`)
      }
      this.#sandbox = undefined
    }

    this.#agent = null
    this.#model = null
    this.#opts = null
    this.#threadId = null
    this.#streamFn = null
    this.#activeLlmConfig = null
    this.#baseSystemPrompt = ``
    this.#soul = ``
  }

  /**
   * Static convenience for one-shot runs (SSE endpoint, TSA).
   * Creates a runner, init+runTurn, auto-destroys on completion.
   */
  static run = async (opts: TAgentRunOpts): Promise<TAgentHandle> => {
    if (opts.signal?.aborted) throw new Error(`Agent run aborted`)

    const runner = new AgentRunner()
    const { prompt, images, files, signal, ...initOpts } = opts

    await runner.init(initOpts)
    const handle = await runner.runTurn({ prompt, images, files, signal })

    // Wrap waitForIdle to auto-destroy runner when done
    const originalWait = handle.waitForIdle
    return {
      ...handle,
      waitForIdle: async () => {
        try {
          await originalWait()
        } finally {
          await runner.destroy()
        }
      },
    }
  }
}

/**
 * Filter for convertToLlm — only pass standard LLM message roles to the provider.
 * Custom message types (artifact, notification, systemEvent) are excluded.
 */
const filterCustomMessages = (messages: AgentMessage[]): Message[] =>
  messages.filter(
    (m) => m.role === `user` || m.role === `assistant` || m.role === `toolResult`
  ) as Message[]
