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
import { parseCommand, findCommand } from '@TRL/commands'
import { getToolDisplayName } from '@TRL/constants/tools'

type AppProps = {
  auth: AuthManager
  initialOrgId?: string
  initialAgentId?: string
  initialThreadId?: string
}

type TAppPhase = 'loading' | 'pickAgent' | 'chat' | 'error'

export function App({ auth, initialOrgId, initialAgentId, initialThreadId }: AppProps) {
  const session = useSession()
  const msgs = useMessages()
  const { exit } = useApp()

  const [phase, setPhase] = useState<TAppPhase>('loading')
  const [agents, setAgents] = useState<any[]>([])
  const [agentInfo, setAgentInfo] = useState<any>(null)
  const [error, setError] = useState<unknown>(null)
  const [verbose, setVerbose] = useState(false)
  const [contextFiles, setContextFiles] = useState<any[]>([])
  const [client] = useState(() => new ApiClient(auth))
  const [executor] = useState(() => new LocalAgentExecutor(client))

  useEffect(() => {
    async function init() {
      try {
        const orgId = initialOrgId || (await resolveOrg(client))
        session.setOrgId(orgId)

        const ctx = ContextLoader.autoDetect(process.cwd())
        setContextFiles(ctx)

        if (initialAgentId) {
          session.setAgentId(initialAgentId)
          session.setThreadId(initialThreadId || null)
          const agent = await client.getAgent(orgId, initialAgentId)
          setAgentInfo(agent)
          session.setConnection('connected')
          setPhase('chat')
          return
        }

        const agentList = await client.listAgents(orgId)
        setAgents(agentList as any[])
        session.setConnection('connected')
        setPhase('pickAgent')
      } catch (e) {
        setError(e)
        setPhase('error')
      }
    }
    init()
  }, [])

  const handleAgentSelect = useCallback(async (agent: any) => {
    session.setAgentId(agent.id)
    setAgentInfo(agent)
    setPhase('chat')
  }, [])

  const handleSubmit = useCallback(
    async (text: string) => {
      if (text.startsWith('/')) {
        const { name, args } = parseCommand(text)
        const cmd = findCommand(name)
        if (cmd) {
          await cmd.handler(args, {
            orgId: session.orgId!,
            agentId: session.agentId!,
            threadId: session.threadId,
            setThreadId: session.setThreadId,
            setAgentId: session.setAgentId,
            setProviderId: (_id: string) => {},
            addContextFile: (path: string) => {
              const file = ContextLoader.loadFile(path)
              if (file) setContextFiles((prev) => [...prev, file])
            },
            removeContextFile: (index: number) => {
              setContextFiles((prev) => prev.filter((_, i) => i !== index))
            },
            setVerbose,
            verbose,
            exit,
          })
          return
        }
      }

      msgs.addMessage({ type: 'user', content: text })
      msgs.setIsStreaming(true)
      msgs.clearStream()

      try {
        const result = await executor.run({
          orgId: session.orgId!,
          agentId: session.agentId!,
          threadId: session.threadId || undefined,
          prompt: text,
          userId: 'repl-user',
          onEvent: (event: any) => {
            switch (event.type) {
              case 'text':
                msgs.setStreamText((prev: string) => prev + (event.text || ''))
                break
              case 'tool_call_start':
                msgs.setToolCalls((prev: any[]) => [
                  ...prev,
                  {
                    name: event.name || '',
                    args: '',
                    status: 'running' as const,
                    summary: `${getToolDisplayName(event.name || '')}...`,
                  },
                ])
                break
              case 'tool_result':
                msgs.setToolCalls((prev: any[]) =>
                  prev.map((t: any, i: number) =>
                    i === prev.length - 1
                      ? {
                          ...t,
                          status: (event.isError ? 'error' : 'success') as const,
                          result: String(event.result || ''),
                        }
                      : t
                  )
                )
                break
            }
          },
        })

        session.setThreadId(result.threadId)
        msgs.addMessage({ type: 'assistant', content: msgs.streamText })
      } catch (e) {
        setError(e)
      } finally {
        msgs.setIsStreaming(false)
        msgs.clearStream()
      }
    },
    [session.orgId, session.agentId, session.threadId, executor, verbose]
  )

  if (phase === 'loading') return <Spinner message="Connecting..." />
  if (phase === 'error') return <ErrorMessage error={error} />

  if (phase === 'pickAgent') {
    return (
      <Box flexDirection="column">
        <Text>{themed('bold', 'Welcome back!')}</Text>
        <AgentPicker
          agents={agents}
          onSelect={handleAgentSelect}
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
        agentName={agentInfo?.name || session.agentId || 'Agent'}
        connection={session.connection}
        messages={msgs.messages}
        isStreaming={msgs.isStreaming}
        streamText={msgs.streamText}
        toolCalls={msgs.toolCalls}
        verbose={verbose}
        onSubmit={handleSubmit}
      />
    </Box>
  )
}

async function resolveOrg(client: ApiClient): Promise<string> {
  const orgs = (await client.listOrgs()) as any[]
  if (orgs.length === 0) throw new Error('No organizations found')
  return orgs[0].id
}
