import type { Response } from 'express'
import type { Endpoint } from '@tdsk/domain'
import type {
  TRequest,
  TAgentExecOpts,
  THeadlessRunOpts,
  TAgentEnsureThread,
} from '@TBE/types'

import { AgentRunner } from '@tdsk/agent'
import { logger } from '@TBE/utils/logger'
import { Exception, EEndpointType } from '@tdsk/domain'
import { BaseEndpoint } from '@TBE/services/endpoints/base'
import { resolveAgentConfig } from '@TBE/utils/agent/resolveAgentConfig'

export class AgentEndpoint extends BaseEndpoint {
  readonly type = EEndpointType.agent

  validateOptions(options: Record<string, any>): void {
    if (!options?.agentId)
      throw new Exception(400, `Agent endpoint requires an agentId in options`)
  }

  async execute(
    req: TRequest,
    res: Response,
    endpoint: Endpoint<EEndpointType.agent>
  ): Promise<void> {
    const userId = req.user?.id
    const opts = endpoint.options
    const { agentId, overrides } = opts
    const { prompt, threadId } = req.body

    if (!prompt) throw new Exception(400, `prompt is required`)
    if (!userId) throw new Exception(401, `Authentication required`)
    if (!agentId) throw new Exception(400, `Agent endpoint has no agentId configured`)

    await this.run(req, res, {
      prompt,
      userId,
      agentId,
      threadId,
      overrides,
    })
  }

  /**
   * Ensures a thread with an ID exists, If a threadId is passed, it's used
   * Otherwise, creates a new thread and returns it's id
   */
  async ensureThread(opts: TAgentEnsureThread) {
    if (opts.threadId) return opts.threadId

    const { name, orgId, prompt, userId, agentId, projectId } = opts

    const { data: thread, error: threadErr } = await this.db.services.thread.create({
      userId,
      agentId,
      projectId,
      orgId: orgId,
      name: name || prompt?.substring?.(0, 100) || `New Thread`,
    })

    if (threadErr || !thread) throw new Exception(500, `Failed to create thread`)

    return thread.id
  }

  /**
   * Transport-agnostic one-shot agent execution.
   * Resolves config, creates/reuses thread, runs AgentRunner, and streams
   * events via the provided onEvent callback without touching `res`.
   */
  runHeadless = async (
    req: TRequest,
    opts: THeadlessRunOpts
  ): Promise<{ threadId: string }> => {
    const {
      prompt,
      userId,
      agentId,
      onEvent,
      overrides,
      projectId,
      providerId,
      resolvedConfig,
    } = opts

    const config =
      resolvedConfig ??
      (await resolveAgentConfig(agentId, this.db, req.app, {
        userId,
        projectId,
        providerId,
        overrides,
      }))

    const threadId = await this.ensureThread({ ...opts, orgId: config.orgId })

    const handle = await AgentRunner.run({
      prompt,
      userId,
      agentId,
      onEvent,
      threadId,
      soul: config.soul,
      db: config.db,
      orgId: config.orgId,
      tools: config.tools,
      skills: config.skills,
      llmConfig: config.llmConfig,
      llmConfigs: config.llmConfigs,
      environment: config.environment,
      sandboxConfig: config.sandboxConfig,
      memoryProvider: config.memoryProvider,
      skillProvider: config.skillProvider,
      taskProvider: config.taskProvider,
      escalationProvider: config.escalationProvider,
      delegateProvider: config.delegateProvider,
      opsProvider: config.opsProvider,
      onExecuteFunction: config.onExecuteFunction,
      customFunctions: config.customFunctions || [],
    })
    await handle.waitForIdle()

    return { threadId }
  }

  /**
   * SSE streaming agent execution.
   * Pre-resolves config and thread (so errors return JSON, not SSE),
   * then delegates to runHeadless() for the actual agent execution.
   */
  run = async (req: TRequest, res: Response, opts: TAgentExecOpts): Promise<void> => {
    const { userId, agentId, overrides, projectId, providerId } = opts

    // Pre-resolve config BEFORE SSE headers so errors return proper JSON responses.
    const config = await resolveAgentConfig(agentId, this.db, req.app, {
      userId,
      overrides,
      projectId,
      providerId,
    })

    const threadId = await this.ensureThread({ ...opts, orgId: config.orgId })

    // Set up SSE headers — after all setup so errors above return proper JSON
    res.setHeader(`X-Thread-Id`, threadId)
    res.setHeader(`Connection`, `keep-alive`)
    res.setHeader(`Cache-Control`, `no-cache`)
    res.setHeader(`Content-Type`, `text/event-stream`)
    res.flushHeaders()

    // Send thread ID as first event
    res.write(`data: ${JSON.stringify({ type: `thread`, threadId })}\n\n`)

    // Handle client disconnect
    let aborted = false
    req.on(`close`, () => {
      aborted = true
    })

    try {
      await this.runHeadless(req, {
        ...opts,
        threadId,
        resolvedConfig: config,
        onEvent: (event) => {
          if (aborted) return
          res.write(`data: ${JSON.stringify(event)}\n\n`)
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Agent execution failed`
      logger.error(`[AgentEndpoint] Agent run failed`, {
        error: err instanceof Error ? err : message,
        stack: err instanceof Error ? err.stack : undefined,
        agentId,
        threadId,
      })
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: `error`, error: message })}\n\n`)
      }
    }

    // End the SSE stream.
    // SSE streams terminate with `[DONE]` sentinel (same convention as OpenAI); WS uses typed JSON `{ type: "done" }`.
    if (!aborted) {
      res.write(`data: [DONE]\n\n`)
      res.end()
    }
  }
}
