import type { TStreamEvent } from '@tdsk/domain'
import type { AuthManager } from '@TRL/services/auth'
import type {
  TAppPhase,
  TReplConfig,
  TContextFile,
  TSelectItem,
  TConnectionStatus,
  TToolCall,
  TSlashCommandContext,
} from '@TRL/types'

import { EStreamEventType } from '@tdsk/domain'
import { ApiClient } from '@TRL/services/api'
import { setTheme } from '@TRL/theme'
import { Executor } from '@TRL/services/executor'
import { ContextLoader } from '@TRL/services/context'
import { resolveOrg } from '@TRL/utils/api/resolveOrg'
import { getToolName } from '@TRL/utils/tools/getToolName'
import { classifyApiError, toFriendlyError } from '@TRL/constants/errors'
import { parseCommand, findCommand, isPreAuthCommand } from '@TRL/commands'

export type TDisplayMessage = {
  id: string
  type: string
  content: string
}

export type TChatLogicOpts = {
  auth: AuthManager
  config?: TReplConfig
  initialOrgId?: string
  initialAgentId?: string
  initialThreadId?: string
  initialProjectId?: string
}

let msgCounter = 0
const nextId = () => `msg-${++msgCounter}`

/**
 * ChatLogic — plain TypeScript class that manages all REPL business logic.
 * Extracted from the React/Ink App.tsx component to work with any renderer.
 *
 * State is stored as plain properties and changes are broadcast via callbacks.
 */
export class ChatLogic {
  // --- Dependencies ---
  #auth: AuthManager
  #config: TReplConfig | undefined
  #initialOrgId: string | undefined
  #initialAgentId: string | undefined
  #initialThreadId: string | undefined
  #initialProjectId: string | undefined

  // --- API / Execution ---
  #client: ApiClient | null = null
  #executor: Executor | null = null

  // --- Session state ---
  phase: TAppPhase = `login`
  orgId: string | null = null
  agentId: string | null = null
  threadId: string | null = null
  projectId: string | null = null
  connection: TConnectionStatus = `disconnected`

  // --- Chat state ---
  messages: TDisplayMessage[] = []
  streamText = ``
  isStreaming = false
  toolCalls: TToolCall[] = []

  // --- Metadata ---
  agentInfo: any = null
  orgName = ``
  projectName = ``
  loggedIn = false
  verbose = false
  providerId: string | null = null
  contextFiles: TContextFile[] = []
  error: Error | null = null

  // --- Picker data ---
  agents: any[] = []
  projects: any[] = []

  // --- Stream buffer (for 50ms throttled flush) ---
  #streamBuffer = ``
  #streamFlushTimer: ReturnType<typeof setInterval> | null = null

  // --- Event callbacks (set by the TUI renderer) ---
  onPhaseChange: ((phase: TAppPhase) => void) | null = null
  onMessagesChange: ((messages: TDisplayMessage[]) => void) | null = null
  onStreamingChange:
    | ((text: string, isStreaming: boolean, toolCalls: TToolCall[]) => void)
    | null = null
  onError: ((error: Error) => void) | null = null
  onAgentsLoaded: ((agents: any[]) => void) | null = null
  onProjectsLoaded: ((projects: any[]) => void) | null = null
  onAgentSelected: ((agent: any) => void) | null = null
  onExit: (() => void) | null = null
  onStatusChange:
    | ((meta: {
        orgName?: string
        agentName?: string
        threadId?: string | null
        connection: TConnectionStatus
        projectName?: string
        modelName?: string
        providerName?: string
      }) => void)
    | null = null

  constructor(opts: TChatLogicOpts) {
    this.#auth = opts.auth
    this.#config = opts.config
    this.#initialOrgId = opts.initialOrgId
    this.#initialAgentId = opts.initialAgentId
    this.#initialThreadId = opts.initialThreadId
    this.#initialProjectId = opts.initialProjectId
    this.verbose = opts.config?.display?.verbose ?? false
    this.loggedIn = opts.auth.loggedIn()

    // Apply theme from config
    if (opts.config?.display?.theme) setTheme(opts.config.display.theme as any)

    // Set initial phase
    this.phase = this.loggedIn ? `loading` : `login`
  }

  // ----------------------------------------------------------------
  // Public lifecycle
  // ----------------------------------------------------------------

  async init(): Promise<void> {
    if (this.loggedIn) await this.#connectAfterLogin()
  }

  destroy(): void {
    this.#stopStreamFlush()
    this.#executor?.destroy()
    this.#executor = null
    this.#client = null
  }

  // ----------------------------------------------------------------
  // Phase transitions
  // ----------------------------------------------------------------

  #setPhase(phase: TAppPhase): void {
    this.phase = phase
    this.onPhaseChange?.(phase)
  }

  // ----------------------------------------------------------------
  // Message helpers
  // ----------------------------------------------------------------

  #addMessage(msg: Omit<TDisplayMessage, 'id'>): void {
    const newMsg = { ...msg, id: nextId() }
    this.messages = [...this.messages, newMsg]
    this.onMessagesChange?.(this.messages)
  }

  #outputMessage(text: string): void {
    this.#addMessage({ type: `system`, content: text })
  }

  #handleCatchError(err: unknown, context: `startup` | `session`): void {
    const error = err instanceof Error ? err : new Error(String(err))
    const kind = classifyApiError(err)

    if (kind === `auth`) {
      this.logout()
      this.#outputMessage(`Session expired or unauthorized. Please log in again.`)
      return
    }

    const friendly = toFriendlyError(error)
    this.#outputMessage(
      `Error: ${friendly.message}${friendly.suggestion ? ` ${friendly.suggestion}` : ``}`
    )

    // Startup errors transition to error phase; session errors preserve current state
    if (context === `startup`) {
      this.error = error
      this.onError?.(this.error)
      this.#setPhase(`error`)
    }
  }

  clearMessages(): void {
    this.messages = []
    this.onMessagesChange?.(this.messages)
  }

  // ----------------------------------------------------------------
  // Streaming helpers
  // ----------------------------------------------------------------

  #startStreamFlush(): void {
    this.#stopStreamFlush()
    this.#streamFlushTimer = setInterval(() => {
      if (this.#streamBuffer) {
        this.streamText = this.#streamBuffer
        this.onStreamingChange?.(this.streamText, this.isStreaming, this.toolCalls)
      }
    }, 50)
  }

  #stopStreamFlush(): void {
    if (this.#streamFlushTimer) {
      clearInterval(this.#streamFlushTimer)
      this.#streamFlushTimer = null
    }
  }

  #setToolCalls(updater: (prev: TToolCall[]) => TToolCall[]): void {
    this.toolCalls = updater(this.toolCalls)
    this.onStreamingChange?.(this.streamText, this.isStreaming, this.toolCalls)
  }

  // ----------------------------------------------------------------
  // Connection & Login
  // ----------------------------------------------------------------

  async #connectAfterLogin(): Promise<void> {
    try {
      this.#setPhase(`loading`)

      const newClient = new ApiClient(this.#auth)
      const newExecutor = new Executor(newClient)
      this.#client = newClient
      this.#executor = newExecutor

      const orgId = this.#initialOrgId || (await resolveOrg(newClient))
      this.orgId = orgId

      // Resolve org name
      try {
        const org = await newClient.getOrg(orgId)
        this.orgName = org.name || orgId
      } catch (err) {
        this.orgName = orgId
        const kind = classifyApiError(err)
        if (kind !== `notFound`) {
          this.#outputMessage(
            `Warning: Could not resolve org name (${err instanceof Error ? err.message : `unknown error`})`
          )
        }
      }

      // Auto-detect context files
      this.contextFiles = ContextLoader.autoDetect(process.cwd())

      // If agent provided directly, skip pickers
      if (this.#initialAgentId) {
        this.agentId = this.#initialAgentId
        this.threadId = this.#initialThreadId || null
        if (this.#initialProjectId) this.projectId = this.#initialProjectId
        const agent = await newClient.getAgent(orgId, this.#initialAgentId)
        this.agentInfo = agent
        this.connection = `connected`
        this.#emitStatusChange()
        this.#setPhase(`chat`)
        this.onAgentSelected?.(agent)
        return
      }

      // If project provided, skip project selection
      if (this.#initialProjectId) {
        this.projectId = this.#initialProjectId
        this.projectName = this.#initialProjectId
        const agentList = await newClient.listAgents(orgId)
        this.agents = agentList as any[]
        this.connection = `connected`
        this.#emitStatusChange()
        this.onAgentsLoaded?.(this.agents)
        this.#setPhase(`pickAgent`)
        return
      }

      // Fetch projects to see if we need project selection
      const projectList = await newClient.listProjects(orgId)
      this.connection = `connected`
      this.#emitStatusChange()

      if (projectList.length > 1) {
        this.projects = projectList
        this.onProjectsLoaded?.(this.projects)
        this.#setPhase(`pickProject`)
      } else {
        // 0 or 1 projects — skip project selection
        if (projectList.length === 1) {
          this.projectId = projectList[0].id
          this.projectName = projectList[0].name || projectList[0].id
        }
        const agentList = await newClient.listAgents(orgId)
        this.agents = agentList as any[]
        this.onAgentsLoaded?.(this.agents)
        this.#setPhase(`pickAgent`)
      }
    } catch (err) {
      this.#handleCatchError(err, `startup`)
    }
  }

  // ----------------------------------------------------------------
  // Auth context
  // ----------------------------------------------------------------

  async login(apiKey: string, proxyUrl?: string, insecure?: boolean): Promise<void> {
    await this.#auth.login(apiKey, proxyUrl, insecure)
    this.loggedIn = true
    await this.#connectAfterLogin()
  }

  logout(): void {
    this.#auth.logout()
    this.loggedIn = false
    this.#setPhase(`login`)

    // Full state reset
    this.orgId = null
    this.agentId = null
    this.threadId = null
    this.projectId = null
    this.connection = `disconnected`
    this.messages = []
    this.streamText = ``
    this.isStreaming = false
    this.toolCalls = []
    this.#streamBuffer = ``
    this.agents = []
    this.projects = []
    this.agentInfo = null
    this.orgName = ``
    this.projectName = ``
    this.contextFiles = []
    this.providerId = null
    this.#client = null
    this.#executor?.destroy()
    this.#executor = null

    this.onMessagesChange?.(this.messages)
    this.onStreamingChange?.(this.streamText, this.isStreaming, this.toolCalls)
    this.#emitStatusChange()
  }

  // ----------------------------------------------------------------
  // Picker selections
  // ----------------------------------------------------------------

  async selectProject(project: any): Promise<void> {
    this.projectId = project.id
    this.projectName = project.name || project.id
    try {
      const agentList = await this.#client!.listAgents(this.orgId!)
      this.agents = agentList as any[]
      if (this.agents.length === 0) {
        this.#outputMessage(`No agents found in org. Create an agent first.`)
        this.#setPhase(`pickProject`)
        return
      }
      this.onAgentsLoaded?.(this.agents)
      this.#setPhase(`pickAgent`)
    } catch (err) {
      this.#handleCatchError(err, `startup`)
    }
  }

  selectAgent(agent: any): void {
    this.agentId = agent.id
    this.agentInfo = agent
    this.#emitStatusChange()
    this.onAgentSelected?.(agent)
    this.#setPhase(`chat`)
  }

  goBackToProjects(): void {
    if (this.projects.length === 0) {
      this.#outputMessage(`No projects available. Use /projects to reload.`)
      return
    }
    this.#setPhase(`pickProject`)
  }

  async switchProject(): Promise<void> {
    if (!this.#client || !this.orgId) {
      this.#outputMessage(`Not connected. Please log in first.`)
      return
    }

    this.error = null
    try {
      const projectList = await this.#client.listProjects(this.orgId)

      if (projectList.length === 0) {
        this.#outputMessage(`No projects found.`)
        return
      }

      if (projectList.length === 1) {
        const agentList = await this.#client.listAgents(this.orgId)
        if (agentList.length === 0) {
          this.#outputMessage(`No agents found in org. Create an agent first.`)
          return
        }

        // API calls succeeded — now reset state
        this.agentId = null
        this.threadId = null
        this.agentInfo = null
        this.agents = agentList as any[]

        this.projectId = projectList[0].id
        this.projectName = projectList[0].name || projectList[0].id
        this.onAgentsLoaded?.(this.agents)
        this.#emitStatusChange()
        this.#setPhase(`pickAgent`)
      } else {
        // API call succeeded — now reset state
        this.agentId = null
        this.threadId = null
        this.agentInfo = null
        this.agents = []

        this.projects = projectList
        this.onProjectsLoaded?.(this.projects)
        this.#setPhase(`pickProject`)
      }
    } catch (err) {
      this.#handleCatchError(err, `session`)
    }
  }

  // ----------------------------------------------------------------
  // Input handling
  // ----------------------------------------------------------------

  async handleLoginSubmit(text: string): Promise<void> {
    if (!text.startsWith(`/`)) {
      this.#outputMessage(`Not logged in. Run /login <api-key> [--insecure] first.`)
      return
    }

    const { name, args } = parseCommand(text)
    const cmd = findCommand(name)

    if (!cmd || !isPreAuthCommand(name)) {
      this.#outputMessage(`Not logged in. Run /login <api-key> [--insecure] first.`)
      return
    }

    const result = await cmd.handler(args, this.#buildCommandContext())
    if (typeof result === `string`) this.#outputMessage(result)
  }

  async handleSubmit(text: string): Promise<void> {
    // Handle slash commands
    if (text.startsWith(`/`)) {
      const { name, args } = parseCommand(text)
      const cmd = findCommand(name)
      if (cmd) {
        const result = await cmd.handler(args, this.#buildCommandContext())
        if (typeof result === `string`) this.#outputMessage(result)
        return
      }
    }

    this.#addMessage({ type: `user`, content: text })
    this.isStreaming = true
    this.streamText = ``
    this.toolCalls = []
    this.#streamBuffer = ``
    this.onStreamingChange?.(this.streamText, this.isStreaming, this.toolCalls)
    this.#startStreamFlush()

    try {
      const currentExecutor = this.#executor
      if (!currentExecutor) {
        this.#addMessage({
          type: `system`,
          content: `Error: Not connected. Please log in first.`,
        })
        return
      }

      const result = await currentExecutor.run({
        prompt: text,
        userId: `repl-user`,
        orgId: this.orgId!,
        agentId: this.agentId!,
        threadId: this.threadId || undefined,
        providerId: this.providerId || undefined,
        contextFiles: this.contextFiles,
        onEvent: (event: TStreamEvent) => {
          switch (event.type) {
            case EStreamEventType.text:
              this.#streamBuffer += event.text || ``
              break
            case EStreamEventType.toolCallStart:
              this.#setToolCalls((prev) => [
                ...prev,
                {
                  name: event.name || ``,
                  args: ``,
                  status: `running` as const,
                  summary: `${getToolName(event.name || ``)}...`,
                },
              ])
              break
            case EStreamEventType.toolCallArgs:
              this.#setToolCalls((prev) =>
                prev.map((t, i) =>
                  i === prev.length - 1
                    ? { ...t, args: (t.args || ``) + (event.args || ``) }
                    : t
                )
              )
              break
            case EStreamEventType.toolResult:
              this.#setToolCalls((prev) =>
                prev.map((t, i) =>
                  i === prev.length - 1
                    ? {
                        ...t,
                        status: event.isError ? (`error` as const) : (`success` as const),
                        result: String(event.content || ``),
                      }
                    : t
                )
              )
              break
            case EStreamEventType.toolExecutionUpdate:
              this.#setToolCalls((prev) =>
                prev.map((t, i) =>
                  i === prev.length - 1
                    ? { ...t, summary: event.content || t.summary }
                    : t
                )
              )
              break
            case EStreamEventType.error:
              this.#addMessage({
                type: `system`,
                content: `Error: ${event.error || `Unknown error`}`,
              })
              break
            case EStreamEventType.done:
              // Completion handled after executor.run() resolves
              break
          }
        },
      })

      this.threadId = result.threadId
      this.#addMessage({ type: `assistant`, content: this.#streamBuffer })
      this.#emitStatusChange()
    } catch (err) {
      // Save partial streaming text before error handling (logout clears messages)
      if (this.#streamBuffer) {
        this.#addMessage({ type: `assistant`, content: this.#streamBuffer })
      }

      this.#handleCatchError(err, `session`)
    } finally {
      this.#stopStreamFlush()
      this.isStreaming = false
      this.streamText = ``
      this.toolCalls = []
      this.#streamBuffer = ``
      this.onStreamingChange?.(this.streamText, this.isStreaming, this.toolCalls)
    }
  }

  // ----------------------------------------------------------------
  // Status emission
  // ----------------------------------------------------------------

  #emitStatusChange(): void {
    const provider = this.agentInfo?.primaryProvider
    let modelName: string | undefined
    try {
      modelName =
        (typeof this.agentInfo?.resolveModel === `function`
          ? this.agentInfo.resolveModel(
              this.providerId || provider?.id,
              provider?.options?.model
            )
          : undefined) || this.agentInfo?.model
    } catch (err) {
      console.warn(`[ChatLogic] resolveModel failed, falling back to agent model`, err)
      modelName = this.agentInfo?.model
    }
    const providerName = provider?.name || provider?.brand

    this.onStatusChange?.({
      orgName: this.orgName || undefined,
      agentName: this.agentInfo?.name || this.agentId || undefined,
      threadId: this.threadId,
      connection: this.connection,
      projectName: this.projectName || undefined,
      modelName: modelName || undefined,
      providerName: providerName || undefined,
    })
  }

  // ----------------------------------------------------------------
  // Command context builder
  // ----------------------------------------------------------------

  #buildCommandContext(): TSlashCommandContext {
    const self = this
    return {
      orgId: this.orgId!,
      agentId: this.agentId!,
      threadId: this.threadId,
      projectId: this.projectId,
      connection: this.connection,
      setAgentId: (id: string) => {
        this.agentId = id
        const cached = this.agents.find((a: any) => a.id === id)
        if (cached) this.agentInfo = cached
        this.#executor?.clearSession()
        this.#emitStatusChange()
      },
      setThreadId: (id: string | null) => {
        this.threadId = id
        this.#emitStatusChange()
      },
      setProjectId: (id: string) => {
        this.projectId = id
      },
      setProviderId: (id: string) => {
        this.providerId = id
        this.#executor?.clearSession()
        this.#emitStatusChange()
      },
      addContextFile: (path: string) => {
        const file = ContextLoader.loadFile(path)
        if (file) {
          this.contextFiles = [...this.contextFiles, file]
        }
      },
      removeContextFile: (index: number) => {
        this.contextFiles = this.contextFiles.filter((_, i) => i !== index)
      },
      clearMessages: () => {
        this.clearMessages()
      },
      get messages() {
        return self.messages
      },
      get contextFiles() {
        return self.contextFiles
      },
      listThreads: async () => {
        if (!this.#client || !this.orgId || !this.agentId) return []
        const threads = await this.#client.listThreads(this.orgId, this.agentId)
        return threads.map((t: any) => ({
          id: t.id,
          name: t.name,
          createdAt: t.createdAt,
        }))
      },
      switchProject: () => this.switchProject(),
      listProjects: async () => {
        if (!this.#client || !this.orgId) return []
        const projects = await this.#client.listProjects(this.orgId)
        return projects.map((p: any) => ({
          id: p.id,
          label: p.name || p.id,
          description: p.description,
        }))
      },
      listAgents: async () => {
        if (!this.#client || !this.orgId) return []
        const agents = await this.#client.listAgents(this.orgId)
        return agents.map((a: any) => ({
          id: a.id,
          label: a.name || a.id,
          description: a.description,
        }))
      },
      deleteThread: async (threadId: string) => {
        if (!this.#client || !this.orgId || !this.agentId) return
        await this.#client.deleteThread(this.orgId, this.agentId, threadId)
      },
      getThreadWithBranches: async (threadId: string) => {
        if (!this.#client || !this.orgId || !this.agentId)
          throw new Error(`Not connected`)
        const thread = await this.#client.getThread(this.orgId, this.agentId, threadId, {
          include: [`branches`, `parent`],
        })
        const raw = thread as unknown as Record<string, unknown>
        return {
          id: thread.id,
          name: thread.name,
          parentThreadId: thread.parentThreadId,
          branches: raw.branches as
            | Array<{ id: string; name?: string; branchMessageId?: string }>
            | undefined,
          parentThread: raw.parentThread as { id: string; name?: string } | undefined,
        }
      },
      branchThread: async (threadId: string, messageId: string) => {
        if (!this.#client || !this.orgId || !this.agentId)
          throw new Error(`Not connected`)
        const thread = await this.#client.branchThread(
          this.orgId,
          this.agentId,
          threadId,
          messageId
        )
        return { id: thread.id, name: thread.name }
      },
      createThread: async (name?: string) => {
        if (!this.#client || !this.orgId || !this.agentId)
          throw new Error(`Not connected`)
        const thread = await this.#client.createThread(this.orgId, this.agentId, name)
        return { id: thread.id, name: thread.name }
      },
      loadThreadMessages: async (threadId: string) => {
        if (!this.#client || !this.orgId || !this.agentId) return
        const messages = await this.#client.listMessages(
          this.orgId,
          this.agentId,
          threadId
        )
        const displayMsgs = messages.map((m: any) => {
          const textContent = Array.isArray(m.content)
            ? m.content
                .filter((c: any) => c.type === `text`)
                .map((c: any) => c.text)
                .join(``)
            : String(m.content || ``)
          return { type: m.type || `assistant`, content: textContent }
        })
        for (const dm of displayMsgs) {
          this.#addMessage(dm)
        }
      },
      showMenu: (
        prompt: string,
        items: TSelectItem[],
        onSelect: (item: TSelectItem) => void,
        options?: { onAction?: (item: TSelectItem) => void }
      ) => {
        this._showMenuHandler?.(prompt, items, onSelect, options)
      },
      closeMenu: () => {
        this._closeMenuHandler?.()
      },
      exit: () => {
        this.destroy()
        this.onExit?.()
      },
      verbose: this.verbose,
      setVerbose: (v: boolean) => {
        this.verbose = v
      },
      auth: {
        loggedIn: this.loggedIn,
        logout: () => this.logout(),
        login: async (apiKey: string, proxyUrl?: string, insecure?: boolean) => {
          await this.login(apiKey, proxyUrl, insecure)
        },
      },
      output: (text: string) => this.#outputMessage(text),
    }
  }

  // --- Menu handler hooks (set by renderer) ---
  _showMenuHandler:
    | ((
        prompt: string,
        items: TSelectItem[],
        onSelect: (item: TSelectItem) => void,
        options?: { onAction?: (item: TSelectItem) => void }
      ) => void)
    | null = null

  _closeMenuHandler: (() => void) | null = null
}
