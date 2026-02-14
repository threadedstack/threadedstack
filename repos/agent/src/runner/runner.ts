import type { TAgentRunOpts } from '@TAG/types'
import type { ISandbox, TAIMessage, TMessageContent } from '@tdsk/domain'

import { getToolDefs } from '@TAG//tools'
import { Mutex } from '@TAG/services/mutex'
import { buildApiLogger } from '@tdsk/logger'
import { createLLMAdapter } from '@TAG/llm/factory'
import { createSandboxProvider } from '@tdsk/sandbox'
import { EContentType, EStreamEventType, EAgentTool } from '@tdsk/domain'

const logger = buildApiLogger(`agent-runner`)

const mutex = new Mutex()

/**
 * AgentRunner - Core orchestration engine
 * Runs a multi-step conversation loop:
 *   1. Send messages to LLM (streaming)
 *   2. Collect tool calls from response
 *   3. Execute tools in sandbox
 *   4. Feed results back to LLM
 *   5. Repeat until LLM stops calling tools (or max steps reached)
 */
export class AgentRunner {
  /**
   * Run an agent conversation step
   * Acquires mutex per thread to prevent concurrent access
   */
  static run = async (opts: TAgentRunOpts): Promise<void> => {
    const {
      threadId,
      prompt,
      db,
      llmConfig,
      sandboxConfig,
      tools,
      maxSteps = 10,
      onEvent,
    } = opts

    let releaseLock: (() => void) | undefined
    let sandbox: ISandbox | undefined

    try {
      // 1. Acquire mutex for this thread
      releaseLock = await mutex.acquire(threadId)

      // 2. Load conversation history
      const { data: existingMessages } = await db.listMessages({
        where: { threadId },
        limit: 100,
        offset: 0,
      })

      const history: TAIMessage[] = (existingMessages || []).map((m: any) => ({
        role: m.type as TAIMessage[`role`],
        content: m.content as TMessageContent[],
      }))

      // 3. Add user message to history
      const userContent: TMessageContent[] = [{ type: EContentType.text, text: prompt }]
      history.push({ role: `user`, content: userContent })

      // 4. Save user message
      await db.createMessage({
        threadId,
        type: `user`,
        content: userContent,
        orgId: opts.orgId,
      })

      // 5. Get tool definitions
      const toolDefs = getToolDefs(tools)

      // 6. Create LLM adapter
      const adapter = createLLMAdapter(llmConfig.provider)

      // 7. Create sandbox if we have tool defs and sandbox config
      if (toolDefs.length > 0 && sandboxConfig?.provider) {
        const provider = createSandboxProvider(sandboxConfig.provider as any)
        sandbox = await provider.create({
          provider: sandboxConfig.provider as any,
          apiKey: sandboxConfig.apiKey,
          template: sandboxConfig.template,
          timeout: sandboxConfig.timeout ?? 300000,
          envVars: sandboxConfig.envVars,
        })
      }

      // 8. Conversation loop
      let step = 0
      let continueLoop = true

      while (continueLoop && step < maxSteps) {
        step++
        const assistantContent: TMessageContent[] = []
        const pendingToolCalls: Array<{ id: string; name: string; args: string }> = []

        // Stream LLM response
        for await (const event of adapter.stream(history, toolDefs, llmConfig)) {
          onEvent(event)

          if (event.type === EStreamEventType.text) {
            assistantContent.push({
              type: EContentType.text,
              text: event.text,
            })
          } else if (event.type === EStreamEventType.toolCallStart) {
            pendingToolCalls.push({ id: event.id, name: event.name, args: `` })
          } else if (event.type === EStreamEventType.toolCallArgs) {
            const tc = pendingToolCalls.find((t) => t.id === event.id)
            if (tc) tc.args += event.args
          } else if (event.type === EStreamEventType.done) {
            if (event.stopReason !== `tool_use`) {
              continueLoop = false
            }
          } else if (event.type === EStreamEventType.error) {
            continueLoop = false
          }
        }

        // Add parsed tool_use content blocks
        for (const tc of pendingToolCalls) {
          let input: Record<string, unknown> = {}
          try {
            input = JSON.parse(tc.args)
          } catch {
            input = { raw: tc.args }
          }

          assistantContent.push({
            type: EContentType.toolUse,
            id: tc.id,
            name: tc.name,
            input,
          })
        }

        // Save assistant message
        history.push({ role: `assistant`, content: assistantContent })
        await db.createMessage({
          threadId,
          type: `assistant`,
          content: assistantContent,
          orgId: opts.orgId,
        })

        // If there are tool calls, run them
        if (pendingToolCalls.length > 0 && sandbox) {
          const toolResults: TMessageContent[] = []

          for (const tc of pendingToolCalls) {
            const result = await AgentRunner.executeTool(sandbox, tc.name, tc.args)

            toolResults.push({
              type: EContentType.toolResult,
              toolUseId: tc.id,
              content: result.output,
              isError: !result.success,
            })

            // Emit tool result event
            onEvent({
              type: EStreamEventType.toolResult,
              toolUseId: tc.id,
              content: result.output,
              isError: !result.success,
            })
          }

          // Add tool results as user message (per Anthropic convention)
          history.push({ role: `user`, content: toolResults })
          await db.createMessage({
            threadId,
            type: `user`,
            content: toolResults,
            orgId: opts.orgId,
          })
        } else if (pendingToolCalls.length > 0 && !sandbox) {
          // Tool calls but no sandbox - error
          const errContent: TMessageContent[] = pendingToolCalls.map((tc) => ({
            type: EContentType.toolResult as const,
            toolUseId: tc.id,
            content: `Error: No sandbox configured for tool execution`,
            isError: true,
          }))

          history.push({ role: `user`, content: errContent })
          await db.createMessage({
            threadId,
            type: `user`,
            content: errContent,
            orgId: opts.orgId,
          })
          continueLoop = false
        } else {
          // No tool calls - we're done
          continueLoop = false
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `Unknown agent error`
      logger.error(`AgentRunner error: ${message}`)
      onEvent({ type: EStreamEventType.error, error: message })
    } finally {
      // Always cleanup
      if (sandbox) {
        try {
          await sandbox.close()
        } catch (e) {
          logger.error(`Failed to close sandbox: ${e}`)
        }
      }
      if (releaseLock) releaseLock()
    }
  }

  /**
   * Execute a tool in the sandbox
   */
  private static executeTool = async (
    sandbox: ISandbox,
    name: string,
    argsJson: string
  ): Promise<{ success: boolean; output: string }> => {
    try {
      let args: Record<string, any> = {}
      try {
        args = JSON.parse(argsJson)
      } catch {
        return { success: false, output: `Invalid JSON arguments: ${argsJson}` }
      }

      switch (name) {
        case EAgentTool.shellExec: {
          const result = await sandbox.exec(args.command, args.args)
          return { success: result.success, output: result.output || result.error || `` }
        }

        case EAgentTool.readFile: {
          const content = await sandbox.readFile(args.path)
          return { success: true, output: content }
        }

        case EAgentTool.writeFile:
          await sandbox.writeFile(args.path, args.content)
          return { success: true, output: `File written to ${args.path}` }

        case EAgentTool.listDir: {
          const entries = await sandbox.listDir(args.path)
          return { success: true, output: entries.join(`\n`) }
        }

        case EAgentTool.deleteFile:
          await sandbox.deleteFile(args.path)
          return { success: true, output: `File deleted: ${args.path}` }

        case EAgentTool.mkdir:
          await sandbox.mkdir(args.path)
          return { success: true, output: `Directory created: ${args.path}` }

        case EAgentTool.fileExists: {
          const exists = await sandbox.fileExists(args.path)
          return { success: true, output: String(exists) }
        }

        case EAgentTool.webSearch:
          return { success: false, output: `Web search not yet implemented` }

        default:
          return { success: false, output: `Unknown tool: ${name}` }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: `Tool execution error: ${message}` }
    }
  }
}
