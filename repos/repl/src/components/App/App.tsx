import type { AuthManager } from '@TRL/auth'
import type { TStreamEvent } from '@tdsk/domain'
import type { TReplConfig, TContextFile } from '@TRL/types'

import { ApiClient } from '@TRL/api'
import { Box, Text, useApp } from 'ink'
import { themed, setTheme } from '@TRL/theme'
import { Executor } from '@TRL/services/executor'
import { useSession } from '@TRL/hooks/useSession'
import { useMessages } from '@TRL/hooks/useMessages'
import { ContextLoader } from '@TRL/services/context'
import { Spinner } from '@TRL/components/Spinner/Spinner'
import { getToolName } from '@TRL/utils/tools/getToolName'
import { ErrorMessage } from '@TRL/components/Message/Error'
import { WelcomeBox } from '@TRL/components/WelcomeBox/WelcomeBox'
import { ChatSession } from '@TRL/components/ChatSession/ChatSession'
import { AgentPicker } from '@TRL/components/AgentPicker/AgentPicker'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { parseCommand, findCommand, isPreAuthCommand } from '@TRL/commands'

type TApp = {
  auth: AuthManager
  config?: TReplConfig
  initialOrgId?: string
  initialAgentId?: string
  initialThreadId?: string
}

type TAppPhase = `login` | `loading` | `pickAgent` | `chat` | `error`

const resolveOrg = async (client: ApiClient): Promise<string> => {
  const orgs = (await client.listOrgs()) as any[]
  if (orgs.length === 0) throw new Error(`No organizations found`)
  return orgs[0].id
}

export const App = (props: TApp) => {
  const { auth, config, initialOrgId, initialAgentId, initialThreadId } = props

  const { exit } = useApp()
  const msgs = useMessages()
  const session = useSession()

  const [verbose, setVerbose] = useState(config?.display?.verbose ?? false)
  const [agents, setAgents] = useState<any[]>([])
  const [error, setError] = useState<Error>(null)
  const [agentInfo, setAgentInfo] = useState<any>(null)
  const [loggedIn, setLoggedIn] = useState(auth.isLoggedIn())
  const [contextFiles, setContextFiles] = useState<TContextFile[]>([])
  const [providerId, setProviderId] = useState<string | null>(null)
  const [client, setClient] = useState(() => (loggedIn ? new ApiClient(auth) : null))
  const [phase, setPhase] = useState<TAppPhase>(auth.isLoggedIn() ? `loading` : `login`)
  const [executor, setExecutor] = useState(() => (client ? new Executor(client) : null))

  // Refs to avoid stale closures in callbacks (P0-1, P0-4, P0-5)
  const streamTextRef = useRef(``)
  const executorRef = useRef<Executor | null>(executor)
  const threadIdRef = useRef<string | null>(session.threadId)
  const contextFilesRef = useRef<TContextFile[]>(contextFiles)
  const clientRef = useRef<ApiClient | null>(client)

  // Keep refs in sync with state
  useEffect(() => {
    executorRef.current = executor
  }, [executor])
  useEffect(() => {
    threadIdRef.current = session.threadId
  }, [session.threadId])
  useEffect(() => {
    contextFilesRef.current = contextFiles
  }, [contextFiles])
  useEffect(() => {
    clientRef.current = client
  }, [client])

  // Apply theme from config on mount (P2-2)
  useEffect(() => {
    if (config?.display?.theme) setTheme(config.display.theme as any)
  }, [])

  const connectAfterLogin = useCallback(async () => {
    try {
      setPhase(`loading`)
      const newClient = new ApiClient(auth)
      const newExecutor = new Executor(newClient)
      setClient(newClient)
      setExecutor(newExecutor)

      const orgId = initialOrgId || (await resolveOrg(newClient))
      session.setOrgId(orgId)

      const ctx = ContextLoader.autoDetect(process.cwd())
      setContextFiles(ctx)

      if (initialAgentId) {
        session.setAgentId(initialAgentId)
        session.setThreadId(initialThreadId || null)
        const agent = await newClient.getAgent(orgId, initialAgentId)
        setAgentInfo(agent)
        session.setConnection(`connected`)
        setPhase(`chat`)
        return
      }

      const agentList = await newClient.listAgents(orgId)
      setAgents(agentList as any[])
      session.setConnection(`connected`)
      setPhase(`pickAgent`)
    } catch (err) {
      setError(err as Error)
      setPhase(`error`)
    }
  }, [initialOrgId, initialAgentId, initialThreadId])

  useEffect(() => {
    if (loggedIn) connectAfterLogin()
  }, [loggedIn, connectAfterLogin])

  // Memoized auth context to avoid recreating handleLoginSubmit each render (P3-6)
  const authContext = useMemo(
    () => ({
      isLoggedIn: loggedIn,
      logout: () => {
        auth.logout()
        setLoggedIn(false)
        setPhase(`login`)
        // Full state reset on logout (P1-5)
        session.setOrgId(``)
        session.setAgentId(``)
        session.setThreadId(null)
        session.setConnection(`disconnected`)
        msgs.setMessages([])
        msgs.clearStream()
        streamTextRef.current = ``
        setAgents([])
        setAgentInfo(null)
        setContextFiles([])
        setProviderId(null)
        setClient(null)
        setExecutor(null)
      },
      login: async (apiKey: string, proxyUrl?: string, insecure?: boolean) => {
        await auth.login(apiKey, proxyUrl, insecure)
        setLoggedIn(true)
      },
    }),
    [loggedIn]
  )

  const outputMessage = useCallback(
    (text: string) => msgs.addMessage({ type: `system`, content: text }),
    [msgs.addMessage]
  )

  const buildCommandContext = () => ({
    orgId: session.orgId!,
    agentId: session.agentId!,
    threadId: session.threadId,
    connection: session.connection,
    setAgentId: (id: string) => {
      session.setAgentId(id)
      // Clear session cache when switching agents
      executorRef.current?.clearSession()
    },
    setThreadId: (id: string | null) => {
      session.setThreadId(id)
      threadIdRef.current = id
    },
    setProviderId: (id: string) => {
      setProviderId(id)
      // Clear session cache when switching providers
      executorRef.current?.clearSession()
    },
    addContextFile: (path: string) => {
      const file = ContextLoader.loadFile(path)
      if (file) setContextFiles((prev) => [...prev, file])
    },
    removeContextFile: (index: number) => {
      setContextFiles((prev) => prev.filter((_, i) => i !== index))
    },
    clearMessages: () => {
      msgs.setMessages([])
    },
    messages: msgs.messages,
    contextFiles,
    listThreads: async () => {
      if (!clientRef.current || !session.orgId || !session.agentId) return []
      const threads = await clientRef.current.listThreads(session.orgId, session.agentId)
      return threads.map((t: any) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
      }))
    },
    loadThreadMessages: async (threadId: string) => {
      if (!clientRef.current || !session.orgId || !session.agentId) return
      const messages = await clientRef.current.listMessages(
        session.orgId,
        session.agentId,
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
        msgs.addMessage(dm)
      }
    },
    exit,
    verbose,
    setVerbose,
    auth: authContext,
    output: outputMessage,
  })

  // Handler for login phase — only allows /login, /help, /exit
  const handleLoginSubmit = useCallback(
    async (text: string) => {
      if (!text.startsWith('/')) {
        outputMessage(`Not logged in. Run /login <api-key> [--insecure] first.`)
        return
      }

      const { name, args } = parseCommand(text)
      const cmd = findCommand(name)

      if (!cmd || !isPreAuthCommand(name)) {
        outputMessage(`Not logged in. Run /login <api-key> [--insecure] first.`)
        return
      }

      const result = await cmd.handler(args, buildCommandContext())
      if (typeof result === `string`) outputMessage(result)
    },
    [exit, authContext]
  )

  // Handler for authenticated chat phase
  const onSubmit = useCallback(
    async (text: string) => {
      // Handle slash commands (P1-1: capture return values)
      if (text.startsWith('/')) {
        const { name, args } = parseCommand(text)
        const cmd = findCommand(name)
        if (cmd) {
          const result = await cmd.handler(args, buildCommandContext())
          if (typeof result === `string`) outputMessage(result)
          return
        }
      }

      msgs.addMessage({ type: `user`, content: text })
      msgs.setIsStreaming(true)
      msgs.clearStream()
      streamTextRef.current = ``

      try {
        const currentExecutor = executorRef.current
        if (!currentExecutor) {
          msgs.addMessage({
            type: `system`,
            content: `Error: Not connected. Please log in first.`,
          })
          return
        }

        const result = await currentExecutor.run({
          prompt: text,
          userId: `repl-user`,
          orgId: session.orgId!,
          agentId: session.agentId!,
          threadId: threadIdRef.current || undefined,
          providerId: providerId || undefined,
          contextFiles: contextFilesRef.current,
          onEvent: (event: TStreamEvent) => {
            switch (event.type) {
              case `text`:
                streamTextRef.current += event.text || ``
                msgs.setStreamText((prev: string) => prev + (event.text || ``))
                break
              case `tool_call_start`:
                msgs.setToolCalls((prev: any[]) => [
                  ...prev,
                  {
                    name: event.name || ``,
                    args: ``,
                    status: `running` as const,
                    summary: `${getToolName(event.name || ``)}...`,
                  },
                ])
                break
              case `tool_call_args`:
                msgs.setToolCalls((prev: any[]) =>
                  prev.map((t: any, i: number) =>
                    i === prev.length - 1
                      ? { ...t, args: (t.args || ``) + (event.args || ``) }
                      : t
                  )
                )
                break
              case `tool_result`:
                msgs.setToolCalls((prev: any[]) =>
                  prev.map((t: any, i: number) =>
                    i === prev.length - 1
                      ? {
                          ...t,
                          status: event.isError ? `error` : `success`,
                          result: String(event.content || ``),
                        }
                      : t
                  )
                )
                break
              case `tool_execution_update`:
                msgs.setToolCalls((prev: any[]) =>
                  prev.map((t: any, i: number) =>
                    i === prev.length - 1
                      ? { ...t, summary: event.content || t.summary }
                      : t
                  )
                )
                break
              case `error`:
                msgs.addMessage({
                  type: `system`,
                  content: `Error: ${event.error || `Unknown error`}`,
                })
                break
              case `done`:
                // Completion handled after executor.run() resolves
                break
            }
          },
        })

        session.setThreadId(result.threadId)
        threadIdRef.current = result.threadId
        // Use ref for current stream text to avoid stale closure (P0-1)
        msgs.addMessage({ type: `assistant`, content: streamTextRef.current })
      } catch (err) {
        // Save partial streaming text on error (P2-10)
        if (streamTextRef.current) {
          msgs.addMessage({ type: `assistant`, content: streamTextRef.current })
        }
        const errMsg = err instanceof Error ? err.message : String(err)
        msgs.addMessage({ type: `system`, content: `Error: ${errMsg}` })
      } finally {
        msgs.setIsStreaming(false)
        msgs.clearStream()
        streamTextRef.current = ``
      }
    },
    [session.orgId, session.agentId, providerId, verbose, loggedIn]
  )

  // Login phase — not authenticated
  if (phase === `login`) {
    return (
      <Box flexDirection="column">
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={2}
          paddingY={1}
        >
          <Text>{themed(`bold`, `ThreadedStack Agent REPL`)}</Text>
          <Text> </Text>
          <Text>{themed(`muted`, `You are not logged in.`)}</Text>
          <Text>
            {themed(`muted`, `Run `)}
            {themed(`primary`, `/login <api-key> [--insecure]`)}
            {themed(`muted`, ` to authenticate.`)}
          </Text>
          <Text> </Text>
          <Text>{themed(`muted`, `Type /help for commands, /exit to quit.`)}</Text>
        </Box>
        <ChatSession
          agentName=""
          connection="disconnected"
          messages={msgs.messages}
          isStreaming={false}
          streamText=""
          toolCalls={[]}
          onSubmit={handleLoginSubmit}
        />
      </Box>
    )
  }

  if (phase === `loading`) return <Spinner message="Connecting..." />

  if (phase === `error`) return <ErrorMessage error={error} />

  if (phase === `pickAgent`) {
    return (
      <Box flexDirection="column">
        <Text>{themed(`bold`, `Welcome back!`)}</Text>
        <AgentPicker
          agents={agents}
          onSelect={(agent: any) => {
            session.setAgentId(agent.id)
            setAgentInfo(agent)
            setPhase(`chat`)
          }}
        />
      </Box>
    )
  }

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
    >
      {agentInfo && (
        <WelcomeBox
          agentName={agentInfo.name || agentInfo.id}
          agentDescription={agentInfo.description}
          contextFileCount={contextFiles.length}
        />
      )}
      <ChatSession
        verbose={verbose}
        onSubmit={onSubmit}
        messages={msgs.messages}
        toolCalls={msgs.toolCalls}
        streamText={msgs.streamText}
        isStreaming={msgs.isStreaming}
        connection={session.connection}
        agentName={agentInfo?.name || session.agentId || 'Agent'}
      />
    </Box>
  )
}
