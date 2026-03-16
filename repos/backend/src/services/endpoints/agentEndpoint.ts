import type { Response } from 'express'
import type { TDatabase } from '@tdsk/database'
import type { TRequest, TAgentExecOpts, THeadlessRunOpts } from '@TBE/types'
import type { Endpoint } from '@tdsk/domain'

import { BaseEndpoint } from './base'
import { logger } from '@TBE/utils/logger'
import { Exception, EEndpointType } from '@tdsk/domain'
import { AgentRunner } from '@tdsk/agent'
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
    endpoint: Endpoint<EEndpointType.agent>,
    db: TDatabase
  ): Promise<void> {
    const userId = req.user?.id
    const opts = endpoint.options
    const { agentId, overrides } = opts
    const { prompt, threadId } = req.body

    if (!prompt) throw new Exception(400, `prompt is required`)
    if (!userId) throw new Exception(401, `Authentication required`)
    if (!agentId) throw new Exception(400, `Agent endpoint has no agentId configured`)

    await this.run(req, res, db, {
      agentId,
      prompt,
      userId,
      threadId,
      overrides,
    })
  }

  /**
   * Transport-agnostic one-shot agent execution.
   * Resolves config, creates/reuses thread, runs AgentRunner, and streams
   * events via the provided onEvent callback without touching `res`.
   */
  runHeadless = async (
    req: TRequest,
    db: TDatabase,
    opts: THeadlessRunOpts
  ): Promise<{ threadId: string }> => {
    const {
      prompt,
      userId,
      agentId,
      overrides,
      projectId,
      providerId,
      onEvent,
      resolvedConfig,
      threadId: existingThreadId,
    } = opts

    const config =
      resolvedConfig ??
      (await resolveAgentConfig(agentId, db, req.app as any, {
        userId,
        projectId,
        providerId,
        overrides,
      }))

    // Get or create thread
    let threadId = existingThreadId
    if (!threadId) {
      const { data: thread, error: threadErr } = await db.services.thread.create({
        userId,
        agentId,
        orgId: config.orgId,
        projectId,
        name: prompt.substring(0, 100),
      })

      if (threadErr || !thread) throw new Exception(500, `Failed to create thread`)
      threadId = thread.id
    }

    const handle = await AgentRunner.run({
      prompt,
      userId,
      agentId,
      threadId,
      llmConfig: config.llmConfig,
      sandboxConfig: config.sandboxConfig,
      orgId: config.orgId,
      db: config.db,
      environment: config.environment,
      tools: config.tools,
      skills: config.skills,
      customFunctions: config.customFunctions || [],
      onExecuteFunction: config.onExecuteFunction,
      onEvent,
    })
    await handle.waitForIdle()

    return { threadId }
  }

  /**
   * SSE streaming agent execution.
   * Pre-resolves config and thread (so errors return JSON, not SSE),
   * then delegates to runHeadless() for the actual agent execution.
   */
  run = async (
    req: TRequest,
    res: Response,
    db: TDatabase,
    opts: TAgentExecOpts
  ): Promise<void> => {
    const { prompt, userId, agentId, projectId, providerId, overrides } = opts
    const existingThreadId = opts.threadId

    // Pre-resolve config BEFORE SSE headers so errors return proper JSON responses.
    const config = await resolveAgentConfig(agentId, db, req.app as any, {
      userId,
      projectId,
      providerId,
      overrides,
    })

    // Pre-create thread for the X-Thread-Id header
    let threadId = existingThreadId
    if (!threadId) {
      const { data: thread, error: threadErr } = await db.services.thread.create({
        userId,
        agentId,
        orgId: config.orgId,
        projectId,
        name: prompt.substring(0, 100),
      })

      if (threadErr || !thread) throw new Exception(500, `Failed to create thread`)
      threadId = thread.id
    }

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
      await this.runHeadless(req, db, {
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
