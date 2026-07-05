/**
 * **IMPORTANT TODO**: Refactor this file and move tool definitions into ./definitions directory
 * Then import definitions into here
 * Tools in the ./definitions directory are old, and no longer used
 * They should be replaced with the tool definitions defined here.
 */

import type {
  IWebProvider,
  ITaskProvider,
  IEscalationProvider,
  IMemoryProvider,
  ISkillProvider,
  IDelegateProvider,
  TDelegateToolOpts,
} from '@TAG/types'
import type { AgentTool } from '@earendil-works/pi-agent-core'
import type {
  ISandbox,
  TFunctionExecResult,
  TSandboxRuntimeId,
  Function as FunctionModel,
} from '@tdsk/domain'

import { logger } from '@TAG/utils/logger'
import { Type } from '@earendil-works/pi-ai'
import {
  EAgentTool,
  MemorySearchTopK,
  DelegationMaxDepth,
  DelegationMaxTimeoutMs,
  DelegationDefaultTimeoutMs,
} from '@tdsk/domain'

/**
 * Creates pi-mono AgentTool definitions backed by an ISandbox instance.
 * Each tool calls `onUpdate()` to stream progress, then returns the final result.
 */
export const createSandboxTools = (
  sandbox: ISandbox,
  allowedTools?: string[]
): AgentTool<any>[] => {
  const tools: AgentTool<any>[] = [
    {
      name: `shellExec`,
      label: `Shell`,
      description: `Run a shell command in the sandbox`,
      parameters: Type.Object({
        command: Type.String({ description: `The command to run` }),
        args: Type.Optional(
          Type.Array(Type.String(), { description: `Command arguments` })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: { command: string; args?: string[] },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [
            {
              type: `text`,
              text: `Running: ${params.command}${params.args ? ` ${params.args.join(` `)}` : ``}`,
            },
          ],
          details: { status: `running` },
        })
        // ISandbox.exec() — sandbox method, not child_process
        const result = await sandbox.exec(params.command, params.args)
        return {
          content: [{ type: `text`, text: result.output || result.error || `` }],
          details: { success: result.success, exitCode: result.exitCode },
        }
      },
    },
    {
      name: `readFile`,
      label: `Read File`,
      description: `Read the contents of a file`,
      parameters: Type.Object({
        path: Type.String({ description: `The file path to read` }),
      }),
      execute: async (
        _toolCallId: string,
        params: { path: string },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Reading: ${params.path}` }],
          details: { status: `running` },
        })
        const content = await sandbox.readFile(params.path)
        return {
          content: [{ type: `text`, text: content }],
          details: { success: true },
        }
      },
    },
    {
      name: `writeFile`,
      label: `Write File`,
      description: `Write content to a file`,
      parameters: Type.Object({
        path: Type.String({ description: `The file path to write` }),
        content: Type.String({ description: `The content to write` }),
      }),
      execute: async (
        _toolCallId: string,
        params: { path: string; content: string },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Writing: ${params.path}` }],
          details: { status: `running` },
        })
        await sandbox.writeFile(params.path, params.content)
        return {
          content: [{ type: `text`, text: `File written to ${params.path}` }],
          details: { success: true },
        }
      },
    },
    {
      name: `listDir`,
      label: `List Directory`,
      description: `List the contents of a directory`,
      parameters: Type.Object({
        path: Type.String({ description: `The directory path to list` }),
      }),
      execute: async (
        _toolCallId: string,
        params: { path: string },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Listing: ${params.path}` }],
          details: { status: `running` },
        })
        const entries = await sandbox.listDir(params.path)
        return {
          content: [{ type: `text`, text: entries.join(`\n`) }],
          details: { success: true },
        }
      },
    },
    {
      name: `deleteFile`,
      label: `Delete File`,
      description: `Delete a file`,
      parameters: Type.Object({
        path: Type.String({ description: `The file path to delete` }),
      }),
      execute: async (
        _toolCallId: string,
        params: { path: string },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Deleting: ${params.path}` }],
          details: { status: `running` },
        })
        await sandbox.deleteFile(params.path)
        return {
          content: [{ type: `text`, text: `File deleted: ${params.path}` }],
          details: { success: true },
        }
      },
    },
    {
      name: `mkdir`,
      label: `Create Directory`,
      description: `Create a directory`,
      parameters: Type.Object({
        path: Type.String({ description: `The directory path to create` }),
      }),
      execute: async (
        _toolCallId: string,
        params: { path: string },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Creating directory: ${params.path}` }],
          details: { status: `running` },
        })
        await sandbox.mkdir(params.path)
        return {
          content: [{ type: `text`, text: `Directory created: ${params.path}` }],
          details: { success: true },
        }
      },
    },
    {
      name: `fileExists`,
      label: `File Exists`,
      description: `Check if a file exists`,
      parameters: Type.Object({
        path: Type.String({ description: `The file path to check` }),
      }),
      execute: async (_toolCallId: string, params: { path: string }) => {
        const exists = await sandbox.fileExists(params.path)
        return {
          content: [{ type: `text`, text: String(exists) }],
          details: { exists },
        }
      },
    },
    {
      name: `evalCode`,
      label: `Evaluate Code`,
      description: `Evaluate JavaScript code in an isolated V8 sandbox`,
      parameters: Type.Object({
        code: Type.String({
          description: `JavaScript code to evaluate. Use 'export default' to return a value.`,
        }),
        timeout: Type.Optional(
          Type.Number({
            description: `Execution timeout in milliseconds (default: 5000)`,
          })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: { code: string; timeout?: number },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Evaluating code...` }],
          details: { status: `running` },
        })
        const result = await sandbox.evaluate(params.code, {
          timeout: params.timeout,
        })
        const output =
          result.result !== undefined
            ? typeof result.result === `string`
              ? result.result
              : JSON.stringify(result.result)
            : result.output || `(no output)`
        return {
          content: [{ type: `text`, text: output }],
          details: { success: true, consoleOutput: result.output },
        }
      },
    },
    {
      name: `createArtifact`,
      label: `Create Artifact`,
      description: `Create a renderable artifact (HTML, SVG, Markdown, code, JSON, CSV, YAML, XML, Mermaid diagram, LaTeX math, image, table, diff, or plaintext). The artifact will be rendered in the UI for the user to view and interact with.`,
      parameters: Type.Object({
        artifactType: Type.Union(
          [
            Type.Literal(`xml`),
            Type.Literal(`svg`),
            Type.Literal(`csv`),
            Type.Literal(`html`),
            Type.Literal(`code`),
            Type.Literal(`json`),
            Type.Literal(`yaml`),
            Type.Literal(`diff`),
            Type.Literal(`latex`),
            Type.Literal(`image`),
            Type.Literal(`table`),
            Type.Literal(`mermaid`),
            Type.Literal(`markdown`),
            Type.Literal(`plaintext`),
          ],
          { description: `The type of artifact to create` }
        ),
        content: Type.String({
          description: `The artifact content`,
        }),
        title: Type.Optional(
          Type.String({ description: `Optional title for the artifact` })
        ),
        language: Type.Optional(
          Type.String({
            description: `Programming language for code artifacts (e.g., "python", "javascript")`,
          })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: {
          artifactType: string
          content: string
          title?: string
          language?: string
        }
      ) => {
        return {
          content: [
            {
              type: `text`,
              text: JSON.stringify({
                title: params.title,
                content: params.content,
                language: params.language,
                artifactType: params.artifactType,
              }),
            },
          ],
          details: {
            success: true,
            title: params.title,
            artifactType: params.artifactType,
          },
        }
      },
    },
  ]

  if (!allowedTools || allowedTools.length === 0) return tools
  return tools.filter((t) => allowedTools.includes(t.name))
}

/**
 * Creates web tool definitions (webSearch, webFetch) independent of any sandbox.
 * These tools only require an IWebProvider instance for HTTP operations.
 */
export const createWebTools = (
  webProvider?: IWebProvider,
  allowedTools?: string[]
): AgentTool<any>[] => {
  const tools: AgentTool<any>[] = [
    {
      name: `webSearch`,
      label: `Web Search`,
      description: `Search the web for information. Returns search results with titles, URLs, and snippets.`,
      parameters: Type.Object({
        query: Type.String({ description: `The search query` }),
        maxResults: Type.Optional(
          Type.Number({ description: `Max results to return (default 5, max 10)` })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: { query: string; maxResults?: number },
        _signal,
        onUpdate
      ) => {
        if (!webProvider) {
          return {
            content: [{ type: `text` as const, text: `Web search not configured` }],
            details: { success: false },
          }
        }
        onUpdate?.({
          content: [{ type: `text`, text: `Searching: ${params.query}` }],
          details: { status: `running` },
        })
        try {
          const maxResults = Math.min(params.maxResults || 5, 10)
          const results = await webProvider.search(params.query, maxResults)
          const text =
            results.length > 0
              ? results
                  .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
                  .join(`\n\n`)
              : `No results found`
          return {
            content: [{ type: `text` as const, text }],
            details: {
              query: params.query,
              success: results.length > 0,
              resultCount: results.length,
            },
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown search error`
          logger.warn(`webSearch tool error: ${message}`)
          return {
            content: [{ type: `text` as const, text: `Search failed: ${message}` }],
            details: { success: false },
          }
        }
      },
    },
    {
      name: `webFetch`,
      label: `Web Fetch`,
      description: `Fetch and extract content from a specific URL. Returns the page content as cleaned markdown text.`,
      parameters: Type.Object({
        url: Type.String({ description: `The URL to fetch` }),
        maxLength: Type.Optional(
          Type.Number({ description: `Max content length in chars (default: 50000)` })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: { url: string; maxLength?: number },
        _signal,
        onUpdate
      ) => {
        if (!webProvider) {
          return {
            content: [{ type: `text` as const, text: `Web fetch not configured` }],
            details: { success: false },
          }
        }
        onUpdate?.({
          content: [{ type: `text`, text: `Fetching: ${params.url}` }],
          details: { status: `running` },
        })
        try {
          const result = await webProvider.fetch(params.url, {
            maxLength: params.maxLength,
          })
          return {
            content: [{ type: `text` as const, text: result.content }],
            details: {
              success: true,
              url: result.url,
              title: result.title,
              contentLength: result.contentLength,
            },
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown fetch error`
          logger.warn(`webFetch tool error: ${message}`)
          return {
            content: [{ type: `text` as const, text: `Fetch failed: ${message}` }],
            details: { success: false },
          }
        }
      },
    },
  ]

  if (!allowedTools || allowedTools.length === 0) return tools
  return tools.filter((t) => allowedTools.includes(t.name))
}

/**
 * Creates memory tool definitions (memorySearch, memoryWrite) for the api brain.
 * These tools only require an IMemoryProvider instance, which the backend
 * implements (db service + EmbeddingService) and injects at runtime.
 */
export const createMemoryTools = (
  memoryProvider: IMemoryProvider,
  allowedTools?: string[]
): AgentTool<any>[] => {
  const tools: AgentTool<any>[] = [
    {
      name: EAgentTool.memorySearch,
      label: `Memory Search`,
      description: `Search durable long-term memory for relevant facts, insights, and prior decisions. Returns scored results with kind and importance.`,
      parameters: Type.Object({
        query: Type.String({ description: `The memory search query` }),
        limit: Type.Optional(
          Type.Number({
            description: `Max memories to return (default ${MemorySearchTopK})`,
          })
        ),
        kinds: Type.Optional(
          Type.Array(Type.String(), {
            description: `Filter by memory kinds (fact, insight, reflection, compaction, roadmap)`,
          })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: { query: string; limit?: number; kinds?: string[] },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Searching memory: ${params.query}` }],
          details: { status: `running` },
        })
        try {
          const results = await memoryProvider.search({
            query: params.query,
            limit: params.limit,
            kinds: params.kinds,
          })
          const text =
            results.length > 0
              ? results
                  .map(
                    (r, i) =>
                      `${i + 1}. [${r.kind}] (importance ${r.importance}${r.score !== undefined ? `, score ${r.score.toFixed(3)}` : ``}) ${r.text}`
                  )
                  .join(`\n\n`)
              : `No memories found`
          return {
            content: [{ type: `text` as const, text }],
            details: {
              query: params.query,
              success: results.length > 0,
              resultCount: results.length,
            },
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown memory error`
          logger.warn(`memorySearch tool error: ${message}`)
          return {
            content: [
              { type: `text` as const, text: `Memory search failed: ${message}` },
            ],
            details: { success: false },
          }
        }
      },
    },
    {
      name: EAgentTool.memoryWrite,
      label: `Memory Write`,
      description: `Persist a durable memory (fact, insight, or decision) for future recall across threads. Returns the new memory id.`,
      parameters: Type.Object({
        text: Type.String({ description: `The memory content to store` }),
        importance: Type.Optional(
          Type.Number({ description: `Importance 1..10 (default 5)` })
        ),
        kind: Type.Optional(
          Type.String({
            description: `Memory kind (fact, insight, reflection, compaction, roadmap). Default fact.`,
          })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: { text: string; importance?: number; kind?: string },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Writing memory...` }],
          details: { status: `running` },
        })
        try {
          const { id } = await memoryProvider.write({
            text: params.text,
            importance: params.importance,
            kind: params.kind,
          })
          return {
            content: [{ type: `text` as const, text: `Memory saved (${id})` }],
            details: { success: true, id },
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown memory error`
          logger.warn(`memoryWrite tool error: ${message}`)
          return {
            content: [{ type: `text` as const, text: `Memory write failed: ${message}` }],
            details: { success: false },
          }
        }
      },
    },
  ]

  if (!allowedTools || allowedTools.length === 0) return tools
  return tools.filter((t) => allowedTools.includes(t.name))
}

/**
 * Creates skill self-improvement tools backed by an ISkillProvider.
 * `authorSkill` proposes a new skill (scanned + promoted server-side, never
 * activated directly); `skillsList`/`skillView` give progressive disclosure of
 * the agent's active skills. Filtered by `allowedTools` like the other factories.
 */
export const createSkillTools = (
  skillProvider: ISkillProvider,
  allowedTools?: string[]
): AgentTool<any>[] => {
  const tools: AgentTool<any>[] = [
    {
      name: EAgentTool.authorSkill,
      label: `Author Skill`,
      description: `Propose a new reusable skill after solving a task worth repeating. Writes a PROPOSAL (not an active skill) that is security-scanned and promoted automatically once approved. Returns the proposal id, status, and any scan findings.`,
      parameters: Type.Object({
        name: Type.String({ description: `Short skill name` }),
        description: Type.String({
          description: `One-line summary of what the skill does`,
        }),
        instructions: Type.String({
          description: `The procedural instructions (SKILL.md body) the skill injects when active`,
        }),
        tools: Type.Optional(
          Type.Array(Type.String(), {
            description: `Agent tool names this skill activates`,
          })
        ),
        triggerKeywords: Type.Optional(
          Type.Array(Type.String(), {
            description: `Keywords that activate this skill when present in a prompt`,
          })
        ),
        alwaysActive: Type.Optional(
          Type.Boolean({ description: `Activate on every turn regardless of keywords` })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: {
          name: string
          description: string
          instructions: string
          tools?: string[]
          triggerKeywords?: string[]
          alwaysActive?: boolean
        },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Proposing skill: ${params.name}` }],
          details: { status: `running` },
        })
        try {
          const { id, status, findings } = await skillProvider.authorSkill(params)
          const text =
            status === `rejected`
              ? `Skill proposal ${id} rejected by security scan: ${findings.join(`; `)}`
              : `Skill proposal ${id} accepted (status ${status}); pending auditor review`
          return {
            content: [{ type: `text` as const, text }],
            details: { success: status !== `rejected`, id, status, findings },
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown skill error`
          logger.warn(`authorSkill tool error: ${message}`)
          return {
            content: [
              { type: `text` as const, text: `Skill proposal failed: ${message}` },
            ],
            details: { success: false },
          }
        }
      },
    },
    {
      name: EAgentTool.skillsList,
      label: `List Skills`,
      description: `List the agent's active skills (name, description, triggers) for progressive disclosure before viewing full instructions.`,
      parameters: Type.Object({}),
      execute: async (_toolCallId: string, _params, _signal, onUpdate) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Listing skills...` }],
          details: { status: `running` },
        })
        try {
          const skills = await skillProvider.listSkills()
          const text =
            skills.length > 0
              ? skills
                  .map(
                    (s) =>
                      `- ${s.id} ${s.name}: ${s.description}${s.alwaysActive ? ` [always]` : ``}`
                  )
                  .join(`\n`)
              : `No active skills`
          return {
            content: [{ type: `text` as const, text }],
            details: { success: true, count: skills.length },
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown skill error`
          logger.warn(`skillsList tool error: ${message}`)
          return {
            content: [{ type: `text` as const, text: `Skill list failed: ${message}` }],
            details: { success: false },
          }
        }
      },
    },
    {
      name: EAgentTool.skillView,
      label: `View Skill`,
      description: `View the full instructions of one active skill by id.`,
      parameters: Type.Object({
        id: Type.String({ description: `The skill id to view` }),
      }),
      execute: async (_toolCallId: string, params: { id: string }, _signal, onUpdate) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Viewing skill ${params.id}...` }],
          details: { status: `running` },
        })
        try {
          const skill = await skillProvider.viewSkill(params.id)
          if (!skill)
            return {
              content: [{ type: `text` as const, text: `Skill ${params.id} not found` }],
              details: { success: false },
            }
          const text = `# ${skill.name}\n${skill.description}\n\nTools: ${skill.tools.join(`, `) || `none`}\nTriggers: ${skill.triggerKeywords.join(`, `) || `none`}\n\n${skill.instructions}`
          return {
            content: [{ type: `text` as const, text }],
            details: { success: true, id: skill.id },
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown skill error`
          logger.warn(`skillView tool error: ${message}`)
          return {
            content: [{ type: `text` as const, text: `Skill view failed: ${message}` }],
            details: { success: false },
          }
        }
      },
    },
  ]

  if (!allowedTools || allowedTools.length === 0) return tools
  return tools.filter((t) => allowedTools.includes(t.name))
}

/**
 * Creates the task self-direction tool backed by an ITaskProvider.
 * `proposeTask` senses a new task PROPOSAL (deduped + security-scanned
 * server-side, never a live task) — the api-brain parity of the runtime-brain
 * fenced `tdsk-tasks` capture. Filtered by `allowedTools` like the other
 * factories.
 */
export const createTaskTools = (
  taskProvider: ITaskProvider,
  allowedTools?: string[]
): AgentTool<any>[] => {
  const tools: AgentTool<any>[] = [
    {
      name: EAgentTool.proposeTask,
      label: `Propose Task`,
      description: `Propose a new backlog task after sensing a signal worth acting on (a bug, a gap, an improvement). Writes a PROPOSAL (not a live task) that is deduped against open proposals and security-scanned before it becomes eligible for the work cycle. Returns the proposal id, status, and any scan findings.`,
      parameters: Type.Object({
        title: Type.String({ description: `Short task title` }),
        description: Type.String({
          description: `What needs to be done and why`,
        }),
        priority: Type.String({
          description: `Priority tier (P0, P1, P2, P3, P4)`,
        }),
        evidence: Type.String({
          description: `Concrete evidence for the signal (log line, error, metric)`,
        }),
        sourceSignal: Type.String({
          description: `Sensor that originated this (ci, deploy-marker, health, schedule-run, log, other)`,
        }),
        dedupeKey: Type.Optional(
          Type.String({
            description: `Stable key that collapses duplicate proposals for the same underlying issue`,
          })
        ),
        repos: Type.Optional(
          Type.Array(Type.String(), {
            description: `Repos this task is expected to touch`,
          })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: {
          title: string
          description: string
          priority: string
          evidence: string
          sourceSignal: string
          dedupeKey?: string
          repos?: string[]
        },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Proposing task: ${params.title}` }],
          details: { status: `running` },
        })
        try {
          const { id, status, findings, deduped } = await taskProvider.proposeTask(params)
          const text = deduped
            ? `Task already proposed (${id})`
            : status === `rejected`
              ? `Task proposal ${id} rejected by scan: ${findings.join(`; `)}`
              : `Task proposal ${id} proposed (status ${status})`
          return {
            content: [{ type: `text` as const, text }],
            details: { success: status !== `rejected`, id, status, findings, deduped },
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown task error`
          logger.warn(`proposeTask tool error: ${message}`)
          return {
            content: [
              { type: `text` as const, text: `Task proposal failed: ${message}` },
            ],
            details: { success: false },
          }
        }
      },
    },
  ]

  if (!allowedTools || allowedTools.length === 0) return tools
  return tools.filter((t) => allowedTools.includes(t.name))
}

/**
 * Creates the escalation tool backed by an IEscalationProvider.
 * `escalate` surfaces a problem that the agent cannot self-resolve
 * (e.g., secret rotation, ops/infra incident, app-level bug requiring human
 * review) as a persistent escalation record. Idempotent via dedupeKey.
 * Filtered by `allowedTools` like the other factories.
 */
export const createEscalateTools = (
  escalationProvider: IEscalationProvider,
  allowedTools?: string[]
): AgentTool<any>[] => {
  const tools: AgentTool<any>[] = [
    {
      name: EAgentTool.escalate,
      label: `Escalate`,
      description: `Escalate a problem that requires human or system intervention and cannot be fully resolved by the agent alone. Use when you detect a condition needing secrets rotation, ops/infra action, or an app bug that warrants a tracked escalation. target must be one of: app|ops|infra|secrets. Idempotent — duplicate escalations for the same dedupeKey are collapsed.`,
      parameters: Type.Object({
        title: Type.String({ description: `Short escalation title` }),
        problem: Type.String({
          description: `Detailed description of the problem and why escalation is needed`,
        }),
        target: Type.String({
          description: `Escalation target faculty: app | ops | infra | secrets`,
        }),
        evidence: Type.Optional(
          Type.Array(Type.String(), {
            description: `Concrete evidence items (log lines, errors, metrics)`,
          })
        ),
        proposedPatch: Type.Optional(
          Type.String({
            description: `Optional patch or remediation sketch (not auto-applied)`,
          })
        ),
        dedupeKey: Type.Optional(
          Type.String({
            description: `Stable key that collapses duplicate escalations for the same underlying issue`,
          })
        ),
        issueRef: Type.Optional(
          Type.String({
            description: `URL of a pre-existing GitHub issue for this escalation`,
          })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: {
          title: string
          problem: string
          target: string
          evidence?: string[]
          proposedPatch?: string
          dedupeKey?: string
          issueRef?: string
        },
        _signal,
        onUpdate
      ) => {
        onUpdate?.({
          content: [{ type: `text`, text: `Escalating: ${params.title}` }],
          details: { status: `running` },
        })
        try {
          const { id, status, routable, deduped } =
            await escalationProvider.escalate(params)
          const text = deduped
            ? `Escalation already open (${id})`
            : routable
              ? `Escalation ${id} routed to ${params.target} faculty`
              : `Escalation ${id} tracked (open, awaiting ${params.target} faculty)`
          return {
            content: [{ type: `text` as const, text }],
            details: { success: true, id, status, routable, deduped },
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown escalation error`
          logger.warn(`escalate tool error: ${message}`)
          return {
            content: [{ type: `text` as const, text: `Escalation failed: ${message}` }],
            details: { success: false },
          }
        }
      },
    },
  ]

  if (!allowedTools || allowedTools.length === 0) return tools
  return tools.filter((t) => allowedTools.includes(t.name))
}

/**
 * Creates the task-delegation tool backed by an IDelegateProvider.
 * `delegateTask` runs a self-contained task as a bounded in-pod child coding
 * process (backend-implemented). The tool REFUSES (failed result, no provider
 * call) once the agent's delegation depth reaches the max, so a delegated
 * child can never delegate again. Filtered by `allowedTools` like the other
 * factories.
 */
export const createDelegateTools = (
  delegateProvider: IDelegateProvider,
  allowedTools?: string[],
  opts?: TDelegateToolOpts
): AgentTool<any>[] => {
  const depth = opts?.delegationDepth ?? 0
  const maxDepth = opts?.maxDelegationDepth ?? DelegationMaxDepth
  const tools: AgentTool<any>[] = [
    {
      name: EAgentTool.delegateTask,
      label: `Delegate Task`,
      description: `Delegate a self-contained coding task to a bounded child coding process running in the agent's body sandbox. Returns the child's output tail, exit code, and a critic verdict. Delegated children cannot delegate further.`,
      parameters: Type.Object({
        task: Type.String({
          description: `Self-contained task prompt for the child process (include all context it needs)`,
        }),
        runtime: Type.Optional(
          Type.String({
            description: `Override the child runtime (claude-code, codex, opencode, ...). Defaults to the body sandbox runtime.`,
          })
        ),
        tools: Type.Optional(
          Type.Array(Type.String(), {
            description: `Advisory tool constraints included in the child prompt`,
          })
        ),
        timeoutMs: Type.Optional(
          Type.Number({
            description: `Wall-clock timeout in ms (default ${DelegationDefaultTimeoutMs}, capped at ${DelegationMaxTimeoutMs})`,
          })
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: { task: string; runtime?: string; tools?: string[]; timeoutMs?: number },
        _signal,
        onUpdate
      ) => {
        if (depth >= maxDepth) {
          return {
            content: [
              {
                type: `text` as const,
                text: `Delegation refused: max delegation depth (${maxDepth}) reached`,
              },
            ],
            details: { success: false, refused: true },
          }
        }
        onUpdate?.({
          content: [{ type: `text`, text: `Delegating task...` }],
          details: { status: `running` },
        })
        try {
          const result = await delegateProvider.delegate({
            task: params.task,
            tools: params.tools,
            timeoutMs: params.timeoutMs,
            runtime: params.runtime as TSandboxRuntimeId | undefined,
          })
          const header = result.success
            ? `Delegated task succeeded`
            : `Delegated task failed${result.error ? `: ${result.error}` : ``}`
          const exitLine =
            result.exitCode !== undefined ? ` (exit ${result.exitCode})` : ``
          const criticLine = result.critic
            ? `\nCritic: ${result.critic.passed ? `PASS` : `FAIL`}: ${result.critic.reason}`
            : ``
          const text = `${header}${exitLine}${criticLine}\n\nOutput (tail):\n${result.output || `(no output)`}`
          return {
            content: [{ type: `text` as const, text }],
            details: {
              success: result.success,
              exitCode: result.exitCode,
              critic: result.critic,
            },
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Unknown delegation error`
          logger.warn(`delegateTask tool error: ${message}`)
          return {
            content: [{ type: `text` as const, text: `Delegation failed: ${message}` }],
            details: { success: false },
          }
        }
      },
    },
  ]

  if (!allowedTools || allowedTools.length === 0) return tools
  return tools.filter((t) => allowedTools.includes(t.name))
}

/**
 * Map a TFunParamType to a TypeBox schema type.
 */
const mapParamType = (type: string, description?: string) => {
  const opts = description ? { description } : {}
  switch (type) {
    case `number`:
      return Type.Number(opts)
    case `boolean`:
      return Type.Boolean(opts)
    case `object`:
      return Type.Record(Type.String(), Type.Any(), opts)
    case `array`:
      return Type.Array(Type.Any(), opts)
    case `string`:
    default:
      return Type.String(opts)
  }
}

/**
 * Returns true when the function has named parameters
 * (either via inputSchema or defaultArgs keys).
 */
const hasNamedParams = (fn: FunctionModel): boolean =>
  (fn.inputSchema?.length ?? 0) > 0 ||
  (fn.defaultArgs ? Object.keys(fn.defaultArgs).length > 0 : false)

/**
 * Build a description string that includes parameter hints for the LLM.
 * Prefers inputSchema (rich info) over defaultArgs (legacy key list).
 */
const buildFunctionDescription = (fn: FunctionModel): string => {
  const base = fn.description || `Custom function: ${fn.name}`

  if (fn.inputSchema?.length) {
    const paramDescs = fn.inputSchema.map((p) => {
      let desc = `${p.name} (${p.type})`
      if (p.description) desc += `: ${p.description}`
      if (p.required) desc += ` [required]`
      return desc
    })
    return `${base}. Parameters: ${paramDescs.join(`; `)}`
  }

  const argKeys = fn.defaultArgs ? Object.keys(fn.defaultArgs) : []
  if (argKeys.length === 0) return base
  return `${base}. Expected arguments: ${argKeys.join(`, `)}`
}

/**
 * Build TypeBox parameters schema for a custom function tool.
 * Prefers inputSchema (typed params) over defaultArgs (legacy string keys).
 */
const buildFunctionParameters = (fn: FunctionModel) => {
  if (fn.inputSchema?.length) {
    const properties: Record<string, any> = {}
    for (const param of fn.inputSchema) {
      const typeSchema = mapParamType(param.type, param.description)
      properties[param.name] = param.required ? typeSchema : Type.Optional(typeSchema)
    }
    return Type.Object(properties, { additionalProperties: true })
  }

  const argKeys = fn.defaultArgs ? Object.keys(fn.defaultArgs) : []
  if (argKeys.length > 0) {
    const properties: Record<string, ReturnType<typeof Type.String>> = {}
    for (const key of argKeys) {
      properties[key] = Type.String({ description: `Value for ${key}` })
    }
    return Type.Object(properties, { additionalProperties: true })
  }

  return Type.Object({
    input: Type.Optional(
      Type.Record(Type.String(), Type.Any(), {
        description: `Input data as key-value pairs passed to the function`,
      })
    ),
  })
}

/**
 * Converts custom FunctionModel definitions into AgentTool[] for the pi-mono Agent.
 * Each tool delegates execution to the caller-provided onExecute callback,
 * which handles sandbox/runtime execution on the backend side.
 */
export const buildCustomFunctionTools = (
  functions: FunctionModel[],
  onExecute: (functionId: string, input: unknown) => Promise<TFunctionExecResult>
): AgentTool<any>[] => {
  return functions.map((fn) => ({
    name: fn.name,
    label: fn.name,
    description: buildFunctionDescription(fn),
    parameters: buildFunctionParameters(fn),
    execute: async (
      _toolCallId: string,
      params: any,
      _signal: AbortSignal,
      onUpdate?: Function
    ) => {
      onUpdate?.({
        content: [{ type: `text`, text: `Executing function: ${fn.name}` }],
        details: { status: `running` },
      })

      // When inputSchema or defaultArgs define named properties, params IS the input directly.
      // When neither is present, params has an `input` wrapper property.
      const input = hasNamedParams(fn) ? params : params.input

      const result = await onExecute(fn.id, input)

      const outputText = result.success
        ? typeof result.output === `string`
          ? result.output
          : JSON.stringify(result.output)
        : result.error || `Function execution failed`

      return {
        content: [{ type: `text`, text: outputText }],
        details: { success: result.success, duration: result.duration },
      }
    },
  }))
}
