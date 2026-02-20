import React, { useState, useCallback, useEffect } from 'react'
import { Box, Text, useApp } from 'ink'
import { useSession } from '@TRL/hooks/useSession'
import { useMessages } from '@TRL/hooks/useMessages'
import { AgentPicker } from './AgentPicker'
import { ChatSession } from './ChatSession'
import { WelcomeBox } from './WelcomeBox'
import { ErrorMessage } from './ErrorMessage'
import { Spinner } from './Spinner'
import { ApiClient } from '@TRL/api'
import { LocalAgentExecutor } from '@TRL/executor'
import { ContextLoader } from '@TRL/services/context'
import type { AuthManager } from '@TRL/auth'
import { themed } from '@TRL/theme'
import { parseCommand, findCommand, isPreAuthCommand } from '@TRL/commands'
import { getToolDisplayName } from '@TRL/constants/tools'

type AppProps = {
  auth: AuthManager
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

export const App = (props: AppProps) => {
  const { auth, initialOrgId, initialAgentId, initialThreadId } = props

  const { exit } = useApp()
  const msgs = useMessages()
  const session = useSession()

  const [verbose, setVerbose] = useState(false)
  const [agents, setAgents] = useState<any[]>([])
  const [error, setError] = useState<Error>(null)
  const [agentInfo, setAgentInfo] = useState<any>(null)
  const [loggedIn, setLoggedIn] = useState(auth.isLoggedIn())
  const [contextFiles, setContextFiles] = useState<any[]>([])
  const [client, setClient] = useState(() => (loggedIn ? new ApiClient(auth) : null))
  const [phase, setPhase] = useState<TAppPhase>(auth.isLoggedIn() ? `loading` : `login`)
  const [executor, setExecutor] = useState(() =>
    client ? new LocalAgentExecutor(client) : null
  )

  const connectAfterLogin = useCallback(async () => {
    try {
      setPhase(`loading`)
      const newClient = new ApiClient(auth)
      const newExecutor = new LocalAgentExecutor(newClient)
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
        setPhase('chat')
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
    loggedIn && connectAfterLogin()
  }, [])

  const authContext = {
    isLoggedIn: loggedIn,
    logout: () => {
      auth.logout()
      setLoggedIn(false)
      setPhase(`login`)
    },
    login: async (apiKey: string, proxyUrl?: string, insecure?: boolean) => {
      await auth.login(apiKey, proxyUrl, insecure)
      setLoggedIn(true)
      connectAfterLogin()
    },
  }

  const outputMessage = useCallback(
    (text: string) => msgs.addMessage({ type: `system`, content: text }),
    [msgs.addMessage]
  )

  const buildCommandContext = () => ({
    orgId: session.orgId!,
    agentId: session.agentId!,
    threadId: session.threadId,
    setAgentId: session.setAgentId,
    setThreadId: session.setThreadId,
    setProviderId: (_id: string) => {},
    addContextFile: (path: string) => {
      const file = ContextLoader.loadFile(path)
      if (file) setContextFiles((prev) => [...prev, file])
    },
    removeContextFile: (index: number) => {
      setContextFiles((prev) => prev.filter((_, i) => i !== index))
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

      await cmd.handler(args, buildCommandContext())
    },
    [exit, authContext]
  )

  // Handler for authenticated chat phase
  const handleSubmit = useCallback(
    async (text: string) => {
      if (text.startsWith('/')) {
        const { name, args } = parseCommand(text)
        const cmd = findCommand(name)
        if (cmd) {
          await cmd.handler(args, buildCommandContext())
          return
        }
      }

      msgs.addMessage({ type: 'user', content: text })
      msgs.setIsStreaming(true)
      msgs.clearStream()

      try {
        const result = await executor!.run({
          orgId: session.orgId!,
          agentId: session.agentId!,
          threadId: session.threadId || undefined,
          prompt: text,
          userId: `repl-user`,
          onEvent: (event: any) => {
            switch (event.type) {
              case `text`:
                msgs.setStreamText((prev: string) => prev + (event.text || ``))
                break
              case `tool_call_start`:
                msgs.setToolCalls((prev: any[]) => [
                  ...prev,
                  {
                    name: event.name || ``,
                    args: ``,
                    status: `running` as const,
                    summary: `${getToolDisplayName(event.name || ``)}...`,
                  },
                ])
                break
              case `tool_result`:
                msgs.setToolCalls((prev: any[]) =>
                  prev.map((t: any, i: number) =>
                    i === prev.length - 1
                      ? {
                          ...t,
                          status: event.isError ? `error` : `success`,
                          result: String(event.result || ``),
                        }
                      : t
                  )
                )
                break
            }
          },
        })

        session.setThreadId(result.threadId)
        msgs.addMessage({ type: `assistant`, content: msgs.streamText })
      } catch (err) {
        setError(err as Error)
      } finally {
        msgs.setIsStreaming(false)
        msgs.clearStream()
      }
    },
    [session.orgId, session.agentId, session.threadId, executor, verbose, loggedIn]
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
        onSubmit={handleSubmit}
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
