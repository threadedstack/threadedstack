import type { TAgentRunOpts } from '@TAG/types'
import type { ISandbox, TStreamEvent } from '@tdsk/domain'
import type { AgentEvent } from '@mariozechner/pi-agent-core'
import type { AssistantMessage, Message, ToolResultMessage } from '@mariozechner/pi-ai'

import { EContentType } from '@tdsk/domain'
import { buildApiLogger } from '@tdsk/logger'
import { getModel } from '@mariozechner/pi-ai'
import { Agent } from '@mariozechner/pi-agent-core'
import { createSandboxProvider } from '@tdsk/sandbox'
import { createStreamProxy } from '@TAG/stream/stream'
import { mapAgentEvent } from '@TAG/adapters/eventBridge'
import { createSandboxTools, buildCustomFunctionTools } from '@TAG/tools/tools'
import {
  convertToLlmMessages,
  convertAssistantToContent,
  convertToolResultToContent,
} from '@TAG/adapters/messageConverter'

const logger = buildApiLogger(`pi-agent-runner`)

/**
 * AgentRunner - Replacement for AgentRunner using pi-mono's Agent class.
 * Preserves the TAgentRunOpts contract so callers (backend, REPL) need minimal changes.
 */
export class AgentRunner {
  static run = async (opts: TAgentRunOpts): Promise<void> => {
    const { db, prompt, onEvent, threadId, llmConfig, sandboxConfig } = opts

    let sandbox: ISandbox | undefined

    try {
      // 1. Load conversation history
      const { data: existingMessages } = await db.listMessages({
        where: { threadId },
        limit: 100,
        offset: 0,
      })

      // 2. Save user message to DB
      const userContent = [{ type: EContentType.text as const, text: prompt }]
      await db.createMessage({
        threadId,
        type: `user`,
        orgId: opts.orgId,
        content: userContent,
      })

      // 3. Create sandbox + tools if configured
      const tools = opts.tools
      if (sandboxConfig?.provider) {
        const provider = createSandboxProvider(sandboxConfig.provider as any)
        sandbox = await provider.create({
          apiKey: sandboxConfig.apiKey,
          envVars: sandboxConfig.envVars,
          template: sandboxConfig.template,
          provider: sandboxConfig.provider as any,
          timeout: sandboxConfig.timeout ?? 300000,
        })
      }
      const agentTools = sandbox ? createSandboxTools(sandbox, tools) : []

      // Build and merge custom function tools
      if (opts.customFunctions?.length && opts.onExecuteFunction) {
        const customTools = buildCustomFunctionTools(
          opts.customFunctions,
          opts.onExecuteFunction
        )
        agentTools.push(...customTools)
      }

      // 4. Convert history to pi-mono messages
      const history = convertToLlmMessages(existingMessages || [])

      // 5. Create pi-mono model
      const model = getModel(llmConfig.provider as any, llmConfig.model as any)

      // 6. Build stream function — use proxy when proxyConfig is provided
      const streamFn = opts.proxyConfig ? createStreamProxy(opts.proxyConfig) : undefined

      // 7. Build pi-mono Agent
      const agent = new Agent({
        initialState: {
          model,
          tools: agentTools,
          messages: history as Message[],
          systemPrompt: llmConfig.systemPrompt || ``,
        },
        streamFn,
        getApiKey: llmConfig.apiKey ? () => llmConfig.apiKey : undefined,
      })

      // 8. Subscribe to events — bridge to TStreamEvent + persist messages
      const unsubscribe = agent.subscribe((event: AgentEvent) => {
        // Map and emit SSE events
        const streamEvent = mapAgentEvent(event)
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

      // 9. Run the agent
      await agent.prompt(prompt)
      await agent.waitForIdle()

      unsubscribe()
    } catch (err) {
      const message = err instanceof Error ? err.message : `Unknown agent error`
      logger.error(`AgentRunner error: ${message}`)
      onEvent({ type: `error`, error: message } as TStreamEvent)
    } finally {
      if (sandbox) {
        try {
          await sandbox.close()
        } catch (e) {
          logger.error(`Failed to close sandbox: ${e}`)
        }
      }
    }
  }
}
