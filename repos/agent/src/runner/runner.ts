import type { ISandbox, TMessageContent, TStreamEvent } from '@tdsk/domain'
import type { AgentEvent, AgentMessage, StreamFn } from '@mariozechner/pi-agent-core'
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
} from '@mariozechner/pi-ai'

import { logger } from '@TAG/utils/logger'
import { Agent } from '@mariozechner/pi-agent-core'
import { createSandboxProvider } from '@tdsk/sandbox'
import { mapAgentEvent } from '@TAG/adapters/eventBridge'
import { isTransientError } from '@TAG/utils/errorClassifier'
import { resolveActiveSkills } from '@TAG/utils/skillResolver'
import { EContentType, buildFallbackModel } from '@tdsk/domain'
import { createContextManager } from '@TAG/utils/contextManager'
import { createWebProvider } from '@TAG/tools/definitions/web/webProvider'
import {
  createSandboxTools,
  createWebTools,
  buildCustomFunctionTools,
} from '@TAG/tools/tools'
import { getModel, streamSimple, isContextOverflow } from '@mariozechner/pi-ai'
import {
  convertToLlmMessages,
  convertAssistantToContent,
  convertToolResultToContent,
} from '@TAG/adapters/messageConverter'

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

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
  #sandbox: ISandbox | undefined
  #threadId: string | null = null
  #model: Model<Api> | null = null
  #streamFn: StreamFn | null = null
  #opts: TAgentInitOpts | null = null
  #unsubscribe: (() => void) | undefined

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

    // 2. Create sandbox + tools if configured
    if (sandboxConfig?.provider) {
      const provider = createSandboxProvider(sandboxConfig.provider as any)
      this.#sandbox = await provider.create({
        envVars: sandboxConfig.envVars,
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
    const webProvider = createWebProvider(opts.environment?.webProvider)
    const sandboxTools = this.#sandbox
      ? createSandboxTools(this.#sandbox, opts.tools)
      : []
    const webTools = createWebTools(webProvider, opts.tools)
    const agentTools = [...sandboxTools, ...webTools]

    // Build and merge custom function tools
    if (opts.customFunctions?.length && opts.onExecuteFunction) {
      const customTools = buildCustomFunctionTools(
        opts.customFunctions,
        opts.onExecuteFunction
      )
      agentTools.push(...customTools)
    }

    // 3. Create pi-mono model
    // getModel returns Model<specific Api> but we store as Model<Api> for multi-provider support
    this.#model =
      ((getModel(llmConfig.provider as any, llmConfig.model as any) ??
        buildFallbackModel(llmConfig)) as Model<Api> | undefined) ?? null

    if (!this.#model)
      throw new Error(
        `Unknown model "${llmConfig.model}" for provider "${llmConfig.provider}"`
      )

    // 4. Convert history to pi-mono messages (using current model's api/provider for AssistantMessage reconstruction)
    const history = convertToLlmMessages(existingMessages || [], {
      api: this.#model.api,
      provider: this.#model.provider,
      model: this.#model.id,
    })

    // 5. Build streamFn wrapper to inject temperature, maxTokens, headers, cacheRetention
    this.#streamFn = (streamModel, context, streamOpts) =>
      streamSimple(streamModel, context, {
        ...streamOpts,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        headers: llmConfig.headers,
        cacheRetention: opts.environment?.cacheRetention,
      })

    // 6. Build context manager for automatic context window management
    const budgetPercent = opts.environment?.contextBudgetPercent ?? 80
    const compaction = opts.environment?.contextCompaction
    const transformContext = createContextManager(
      this.#model,
      budgetPercent,
      compaction?.enabled
        ? {
            strategy: compaction.strategy,
            streamFn: this.#streamFn,
            compactionModel: compaction.compactionModel,
          }
        : undefined
    )

    // 7. Build pi-mono Agent with convertToLlm filter
    const thinkingLevel = opts.environment?.thinkingLevel
    this.#agent = new Agent({
      streamFn: this.#streamFn,
      sessionId: threadId,
      transformContext,
      convertToLlm: filterCustomMessages,
      getApiKey: llmConfig.apiKey ? () => llmConfig.apiKey : undefined,
      thinkingBudgets: opts.environment?.thinkingBudgets,
      initialState: {
        model: this.#model,
        tools: agentTools,
        messages: history as Message[],
        systemPrompt: llmConfig.systemPrompt || ``,
        ...(thinkingLevel && thinkingLevel !== `off` ? { thinkingLevel } : {}),
      },
    })

    // 7b. Store the base system prompt for skill resolution per-turn
    this.#baseSystemPrompt = llmConfig.systemPrompt || ``

    // 8. Subscribe to events — bridge to TStreamEvent + persist messages
    this.#unsubscribe = this.#agent.subscribe((event: AgentEvent) => {
      const streamEvent = mapAgentEvent(event, this.#model)
      if (streamEvent) onEvent(streamEvent)

      // Persist messages on turn_end
      if (event.type === `turn_end`) {
        const assistantMsg = event.message as AssistantMessage
        if (assistantMsg?.role === `assistant`) {
          const content = convertAssistantToContent(assistantMsg)
          db.createMessage({
            content,
            threadId,
            type: `assistant`,
            orgId: opts.orgId,
          }).catch((err) => logger.error(`Failed to persist assistant message: ${err}`))
        }

        for (const tr of event.toolResults) {
          const toolContent = convertToolResultToContent(tr as ToolResultMessage)
          db.createMessage({
            threadId,
            type: `user`,
            orgId: opts.orgId,
            content: [toolContent],
          }).catch((err) => logger.error(`Failed to persist tool result: ${err}`))
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
      this.#agent!.setSystemPrompt(updatedPrompt)

      // Merge skill-requested tools with the agent's base tool set
      if (resolved.tools.length > 0) {
        const mergedToolNames = [
          ...new Set([...(initOpts.tools || []), ...resolved.tools]),
        ]
        const skillWebProvider = createWebProvider(initOpts.environment?.webProvider)
        const mergedSandboxTools = this.#sandbox
          ? createSandboxTools(this.#sandbox, mergedToolNames)
          : []
        const mergedWebTools = createWebTools(skillWebProvider, mergedToolNames)
        const mergedTools = [...mergedSandboxTools, ...mergedWebTools]

        // Re-add custom function tools if present
        if (initOpts.customFunctions?.length && initOpts.onExecuteFunction) {
          const customTools = buildCustomFunctionTools(
            initOpts.customFunctions,
            initOpts.onExecuteFunction
          )
          mergedTools.push(...customTools)
        }

        this.#agent!.setTools(mergedTools)
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
    const model = this.#model!
    let runPromise: Promise<void>
    try {
      runPromise = (async () => {
        try {
          await agent.prompt(fullPrompt, imageContents)
          await agent.waitForIdle()

          // Retry loop for transient failures
          const maxRetries = initOpts.environment?.maxRetries ?? 2
          let retries = 0
          while (retries < maxRetries && agent.state.error && !signal?.aborted) {
            const errorStr =
              typeof agent.state.error === `string`
                ? agent.state.error
                : ((agent.state.error as any)?.message ?? String(agent.state.error))
            if (!isTransientError(errorStr)) break
            retries++
            logger.warn(
              `Transient error, retrying (${retries}/${maxRetries}): ${errorStr}`
            )
            await delay(1000 * retries)
            await agent.continue()
            await agent.waitForIdle()
          }

          // Check for context overflow after agent completes
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
        } finally {
          cleanup()
        }
      })()
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
        this.#agent.setModel(newModel)
      }
    }

    if (config.systemPrompt !== undefined) {
      this.#baseSystemPrompt = config.systemPrompt
      this.#agent.setSystemPrompt(config.systemPrompt)
    }

    if (config.thinkingLevel) {
      this.#agent.setThinkingLevel(config.thinkingLevel as any)
    }

    if (config.tools) {
      const configWebProvider = createWebProvider(this.#opts?.environment?.webProvider)
      const newSandboxTools = this.#sandbox
        ? createSandboxTools(this.#sandbox, config.tools)
        : []
      const newWebTools = createWebTools(configWebProvider, config.tools)
      this.#agent.setTools([...newSandboxTools, ...newWebTools])
    }
  }

  /**
   * Destroy the runner — cleans up sandbox, subscriptions, and agent.
   * After destroy, init() can be called again for a new session.
   */
  async destroy(): Promise<void> {
    this.#unsubscribe?.()
    this.#unsubscribe = undefined

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
    this.#baseSystemPrompt = ``
  }

  /**
   * Static convenience for one-shot runs (SSE endpoint, REPL).
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
